"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LanguageMode } from "@/shared/languages";
import { ABUSE_MESSAGE, findAbuse, redactAbuse } from "@/shared/moderation";
import { getPersona, PERSONAS, type PersonaId } from "@/shared/personas";
import { startMic } from "./audio/mic";
import { bytesToBase64, rmsLevel } from "./audio/pcm";
import { PcmPlayer } from "./audio/player";
import type { CallStatus, CaptionLine, ServerEvent, SessionResponse } from "./types";

// While the companion is talking, mic audio quieter than this is treated as its own echo from the
// speakers and sent as silence, so it cannot interrupt itself. Normal speech is well above it.
const BARGE_IN_LEVEL = 0.045;

type SpokenLang = "en" | "zh" | "hi";

/**
 * Script-based detection of what the user just spoke or typed (Auto language mode), with a strength
 * so one mis-transcribed phrase can't flip the language (STT sometimes hears English as Chinese).
 */
function detectLang(text: string): { lang: SpokenLang; strong: boolean } | undefined {
  const devanagari = text.match(/[\u0900-\u097f]/g)?.length ?? 0;
  const latinWords = text.match(/[a-z]{2,}/gi)?.length ?? 0;
  if (devanagari > 0 && latinWords === 0) return { lang: "hi", strong: devanagari >= 12 };
  if (latinWords >= 2) return { lang: "en", strong: true };
  return undefined;
}

// Boson rejects system messages mid-call, so a language switch is applied as a session.update.
const LANGUAGE_OVERRIDE: Record<SpokenLang, string> = {
  en: "",
  zh: "\n\nLANGUAGE OVERRIDE: the user is now speaking Chinese (中文). Reply ONLY in Mandarin Chinese.",
  hi: "\n\nLANGUAGE OVERRIDE: the user is now speaking Hindi (हिन्दी). Reply ONLY in Hindi.",
};

const HANDOFF_PHRASE = new RegExp(`let me bring in your (${PERSONAS.map((p) => p.name).join("|")})`, "i");

/** Matches "Let me bring in your X." but not offers like "Should I bring in your X?". */
function spokenHandoffTarget(text: string): PersonaId | undefined {
  const match = HANDOFF_PHRASE.exec(text);
  if (!match) return undefined;
  const rest = text.slice(match.index);
  const end = rest.search(/[.!?]/);
  if (end >= 0 && rest[end] === "?") return undefined;
  return PERSONAS.find((p) => p.name.toLowerCase() === match[1].toLowerCase())?.id;
}

interface Handoff {
  from: string;
  reason: string;
  recent: { role: "user" | "assistant"; text: string }[];
}

interface ToolCall {
  call_id?: string;
  name?: string;
  arguments?: string;
}

/** Audio and mic live for the whole call; the WebSocket is one "leg" and is swapped on a council handoff. */
interface CallResources {
  ws?: WebSocket;
  ctx?: AudioContext;
  player?: PcmPlayer;
  stopMic?: () => void;
  personaId?: PersonaId;
  userName?: string;
  language?: LanguageMode;
  pushToTalk: boolean;
  pttHeld: boolean;
  /** Last ~0.4 s of mic audio before a push-to-talk press, so the first word isn't clipped. */
  preRoll: ArrayBuffer[];
  lastLevelAt: number;
  turnStartedAt: number;
  turnMaxLevel: number;
  baseInstructions?: string;
  spokenLang: SpokenLang;
  /** A pending non-English detection waiting for a second confirming turn. */
  langVote?: SpokenLang;
  replyAfterTranscript: boolean;
  responseActive: boolean;
  callId?: number;
  greetedWith?: string;
  greetingPlaying: boolean;
  speakingItemId?: string;
  lastSpoken?: string;
  legReady: boolean;
  usage: { input_tokens: number; output_tokens: number; cached_tokens: number };
  handingOff: boolean;
  interruptedItems: Set<string>;
  handledCalls: Set<string>;
}

interface Options {
  /** Fired after a server-side tool ran (e.g. to refresh the timeline). */
  onToolExecuted?: (name: string) => void;
  /** Fired when the Inner Council hands the call to another persona. */
  onPersonaChange?: (personaId: PersonaId) => void;
}

const freshResources = (): CallResources => ({
  legReady: false,
  pushToTalk: false,
  pttHeld: false,
  preRoll: [],
  lastLevelAt: 0,
  turnStartedAt: 0,
  turnMaxLevel: 0,
  spokenLang: "en",
  replyAfterTranscript: false,
  responseActive: false,
  usage: { input_tokens: 0, output_tokens: 0, cached_tokens: 0 },
  greetingPlaying: false,
  handingOff: false,
  interruptedItems: new Set(),
  handledCalls: new Set(),
});

export function useRealtimeCall({ onToolExecuted, onPersonaChange }: Options = {}) {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<CaptionLine[]>([]);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [hint, setHint] = useState<string | null>(null);

  const res = useRef<CallResources>(freshResources());
  const linesRef = useRef<CaptionLine[]>([]);
  const observeTimers = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; text: string; personaId: string }>());
  const callbacks = useRef({ onToolExecuted, onPersonaChange });
  useEffect(() => {
    callbacks.current = { onToolExecuted, onPersonaChange };
  }, [onToolExecuted, onPersonaChange]);
  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  const upsertLine = useCallback((id: string, update: (prev?: CaptionLine) => CaptionLine) => {
    setLines((prev) => {
      const i = prev.findIndex((l) => l.id === id);
      if (i === -1) return [...prev, update(undefined)];
      const next = prev.slice();
      next[i] = update(prev[i]);
      return next;
    });
  }, []);

  const send = useCallback((event: Record<string, unknown>) => {
    const ws = res.current.ws;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event));
  }, []);

  /** Auto language: if the user switched script (e.g. to Chinese), switch the companion's language too. */
  const followLanguage = useCallback(
    (text: string): boolean => {
      const r = res.current;
      if (r.language !== "auto" || !r.baseInstructions) return false;
      const detected = detectLang(text);
      if (!detected) return false;
      const { lang, strong } = detected;
      if (lang === r.spokenLang) {
        r.langVote = undefined;
        return false;
      }
      // Leaving the current language needs a long clear sentence, or two short ones in a row.
      if (!strong && r.langVote !== lang) {
        r.langVote = lang;
        return false;
      }
      r.langVote = undefined;
      r.spokenLang = lang;
      send({ type: "session.update", session: { instructions: r.baseInstructions + LANGUAGE_OVERRIDE[lang] } });
      return true;
    },
    [send],
  );

  /** Hands one user utterance to the Listener agent (moods, memories, Bridge nudges). */
  const observe = useCallback((text: string, personaId: string) => {
    if (!text || !personaId) return;
    void fetch("/api/observe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, personaId }),
    })
      .then(() => callbacks.current.onToolExecuted?.("listener"))
      .catch(() => undefined);
  }, []);

  const teardown = useCallback(() => {
    const ending = res.current;
    if (ending.callId) {
      // Call log + learning loop: the server stores the transcript and summarizes it.
      const lines = linesRef.current
        .filter((l) => l.text.trim())
        .slice(-300)
        .map((l) => ({ role: l.role, text: (l.interrupted ? `${l.text} (interrupted)` : l.text).slice(0, 1500) }));
      const body = JSON.stringify({ lines, usage: ending.usage });
      void fetch(`/api/calls/${ending.callId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: body.length < 60_000, // browsers reject keepalive bodies over 64 KB
      })
        .then(() => callbacks.current.onToolExecuted?.("call-ended"))
        .catch(() => undefined);
      ending.callId = undefined;
    }
    // Don't lose the last thing they said right before hanging up.
    for (const pending of observeTimers.current.values()) {
      clearTimeout(pending.timer);
      observe(pending.text, pending.personaId);
    }
    observeTimers.current.clear();
    const r = res.current;
    r.stopMic?.();
    r.player?.stop();
    if (r.ws && r.ws.readyState <= WebSocket.OPEN) r.ws.close(1000, "hang up");
    r.ctx?.close().catch(() => undefined);
    res.current = freshResources();
    setAiSpeaking(false);
    setUserSpeaking(false);
    setThinking(false);
    setMicLevel(0);
  }, [observe]);

  const fail = useCallback(
    (message: string) => {
      setError(message);
      setStatus("error");
      teardown();
    },
    [teardown],
  );

  /** Abuse detected: stop the reply now, record why, end the call, and alert the user. */
  const cutOff = useCallback(
    (text: string, lineId: string) => {
      const r = res.current;
      r.player?.stop();
      if (r.ws?.readyState === WebSocket.OPEN) r.ws.send(JSON.stringify({ type: "response.cancel" }));
      // Build the final transcript synchronously: teardown logs the call from linesRef right below.
      const redacted = redactAbuse(text);
      let next: CaptionLine[] = linesRef.current.map((l) => (l.id === lineId ? { ...l, text: redacted, final: true } : l));
      if (!next.some((l) => l.id === lineId)) next = [...next, { id: lineId, role: "user", text: redacted, final: true }];
      next = [...next, { id: `moderation-${Date.now()}`, role: "system", text: ABUSE_MESSAGE, final: true }];
      linesRef.current = next;
      setLines(next);
      setError(ABUSE_MESSAGE);
      teardown();
      setStatus("ended");
    },
    [teardown],
  );

  // Declared before use via ref so connectLeg and handoff can call each other.
  const connectLegRef = useRef<(personaId: PersonaId, handoff?: Handoff) => Promise<void>>(async () => undefined);

  const handOff = useCallback(async (call: ToolCall) => {
    const r = res.current;
    let target: PersonaId | undefined;
    let reason = "";
    try {
      const args = JSON.parse(call.arguments ?? "{}") as { persona?: string; reason?: string };
      target = getPersona(args.persona ?? "")?.id;
      reason = args.reason ?? "";
    } catch {
      // fall through with no target
    }
    if (!target || target === r.personaId || r.handingOff) return false;

    r.handingOff = true;
    const from = r.personaId!;
    await r.player?.whenIdle(); // let the "let me bring in..." line finish
    if (res.current !== r) return true; // hung up meanwhile

    const old = r.ws;
    r.ws = undefined;
    old?.close(1000, "handoff");

    const recent = linesRef.current
      .filter((l): l is CaptionLine & { role: "user" | "assistant" } => l.role !== "system" && l.text.length > 0)
      .slice(-8)
      .map((l) => ({ role: l.role, text: l.text.slice(0, 500) }));
    const fromName = getPersona(from)?.name ?? from;
    const toName = getPersona(target)?.name ?? target;
    setLines((prev) => [
      ...prev,
      { id: `handoff-${Date.now()}`, role: "system", text: `${fromName} brought in ${toName}`, final: true },
    ]);
    callbacks.current.onPersonaChange?.(target);
    try {
      await connectLegRef.current(target, { from, reason, recent });
    } catch (err) {
      if (res.current === r) fail(`Handoff failed: ${(err as Error).message}`);
    } finally {
      r.handingOff = false;
    }
    return true;
  }, [fail]);

  /** Voice-agent tool calls. Only the council handoff lives here; bookkeeping is done by the Listener agent. */
  const runToolCalls = useCallback(
    async (calls: ToolCall[], spokenText: string) => {
      const r = res.current;
      const fresh = calls.filter((c) => c.call_id && c.name && !r.handledCalls.has(c.call_id));
      fresh.forEach((c) => r.handledCalls.add(c.call_id!));

      let handoffCall = fresh.find((c) => c.name === "bring_in_persona");
      if (!handoffCall) {
        // Backup trigger: the model said the handoff line but skipped the tool call.
        const target = spokenHandoffTarget(spokenText);
        if (target) {
          handoffCall = { arguments: JSON.stringify({ persona: target, reason: "The conversation called for this self." }) };
        }
      }
      if (handoffCall && (await handOff(handoffCall))) return; // the new leg speaks next

      if (fresh.length === 0) return;
      for (const call of fresh) {
        send({
          type: "conversation.item.create",
          item: { type: "function_call_output", call_id: call.call_id, output: JSON.stringify({ ok: false }) },
        });
      }
      send({ type: "response.create" });
    },
    [handOff, send],
  );

  const handleEvent = useCallback(
    async (event: ServerEvent, ws: WebSocket) => {
      const r = res.current;
      if (r.ws !== ws) return; // late event from a previous leg
      switch (event.type) {
        // Higgs acks session.update with session.created (it does not emit session.updated).
        case "session.created":
        case "session.updated": {
          if (r.legReady || !r.ctx) return;
          r.legReady = true;
          if (!r.stopMic) {
            try {
              const stopMic = await startMic(r.ctx, (pcm) => {
                const level = rmsLevel(pcm);
                const now = performance.now();
                if (now - r.lastLevelAt > 120) {
                  r.lastLevelAt = now;
                  setMicLevel(level);
                }
                if (r.pttHeld) r.turnMaxLevel = Math.max(r.turnMaxLevel, level);
                if (r.pushToTalk && !r.pttHeld) {
                  // Not streaming, but keep a short pre-roll for the next press.
                  r.preRoll.push(pcm);
                  if (r.preRoll.length > 10) r.preRoll.shift();
                  return;
                }
                const echoOnly =
                  (!r.pushToTalk && r.greetingPlaying) || (!r.pushToTalk && r.player?.active && level < BARGE_IN_LEVEL);
                const audio = echoOnly ? new ArrayBuffer(pcm.byteLength) : pcm;
                send({ type: "input_audio_buffer.append", audio: bytesToBase64(audio) });
              });
              if (res.current !== r) {
                stopMic(); // hung up while the permission prompt was open
                return;
              }
              r.stopMic = stopMic;
            } catch (err) {
              if (res.current === r) fail(`Microphone unavailable: ${(err as Error).message}`);
              return;
            }
          }
          if (res.current !== r) return;
          setStatus("live");
          // The companion is the one calling (or just joined), so it speaks first,
          // unless the avatar greeting clip is already saying hello on the first leg.
          if (r.greetedWith) r.greetedWith = undefined;
          else send({ type: "response.create" });
          return;
        }
        case "input_audio_buffer.speech_started": {
          // Barge-in: silence the assistant immediately.
          const wasPlaying = r.player?.active ?? false;
          r.player?.stop();
          setUserSpeaking(true);
          if (r.speakingItemId && wasPlaying) {
            const id = r.speakingItemId;
            r.interruptedItems.add(id);
            upsertLine(id, (prev) => ({ ...(prev ?? { id, role: "assistant", text: "" }), interrupted: true, final: true }));
          }
          r.speakingItemId = undefined;
          return;
        }
        case "input_audio_buffer.speech_stopped":
          setUserSpeaking(false);
          setThinking(true);
          return;
        case "conversation.item.added":
          // Placeholder bubble for the user's spoken turn; text arrives with the transcription event.
          if (event.item?.role === "user" && event.item.id) {
            const id = event.item.id;
            upsertLine(id, (prev) => prev ?? { id, role: "user", text: "", final: false });
          }
          return;
        case "input_audio_buffer.committed":
          if (event.item_id) {
            const id = event.item_id;
            upsertLine(id, (prev) => prev ?? { id, role: "user", text: "", final: false });
          }
          return;
        case "conversation.item.input_audio_transcription.completed":
          if (event.item_id) {
            const id = event.item_id;
            const text = (event.transcript ?? "").trim();
            if (findAbuse(text)) {
              r.replyAfterTranscript = false;
              cutOff(text, id);
              return;
            }
            // Hands-free: Boson always auto-replies at end of turn. If the language just switched and that
            // reply is already running in the old language, cancel it and ask again in the new one.
            const switched = followLanguage(text);
            if (switched && !r.pushToTalk && r.responseActive) {
              r.player?.stop();
              const stale = r.speakingItemId;
              if (stale) {
                r.interruptedItems.add(stale);
                setLines((prev) => prev.filter((l) => l.id !== stale));
              }
              r.speakingItemId = undefined;
              send({ type: "response.cancel" });
              send({ type: "response.create" });
            }
            if (r.replyAfterTranscript) {
              r.replyAfterTranscript = false;
              send({ type: "response.create" });
            }
            upsertLine(id, () => ({ id, role: "user", text, final: true }));
            // Higgs can refine a transcript for the same item; only the last version goes to the Listener.
            const pending = observeTimers.current.get(id);
            if (pending) clearTimeout(pending.timer);
            const personaId = r.personaId ?? "";
            observeTimers.current.set(id, {
              text,
              personaId,
              timer: setTimeout(() => {
                observeTimers.current.delete(id);
                observe(text, personaId);
              }, 800),
            });
          }
          return;
        case "response.output_audio.delta":
          if (event.item_id && r.interruptedItems.has(event.item_id)) return; // late audio after barge-in
          setThinking(false);
          if (event.delta) r.player?.enqueue(event.delta);
          if (event.item_id) r.speakingItemId = event.item_id;
          return;
        case "response.output_audio_transcript.delta":
          if (event.item_id && event.delta) {
            const id = event.item_id;
            const delta = event.delta;
            upsertLine(id, (prev) =>
              prev?.interrupted ? prev : { id, role: "assistant", text: (prev?.text ?? "") + delta, final: false },
            );
          }
          return;
        case "response.output_audio_transcript.done":
          r.lastSpoken = event.transcript ?? "";
          if (event.item_id) {
            const id = event.item_id;
            upsertLine(id, (prev) =>
              prev?.interrupted ? prev : { id, role: "assistant", text: event.transcript ?? prev?.text ?? "", final: true },
            );
          }
          return;
        case "response.created":
          r.responseActive = true;
          return;
        case "response.done": {
          r.responseActive = false;
          // Exact token usage per reply, summed per call for the usage dashboard.
          const u = event.response?.usage;
          if (u) {
            r.usage.input_tokens += u.input_tokens ?? 0;
            r.usage.output_tokens += u.output_tokens ?? 0;
            r.usage.cached_tokens += u.input_token_details?.cached_tokens ?? 0;
          }
          const calls = (event.response?.output ?? []).filter((o) => o.type === "function_call");
          const spoken = r.lastSpoken ?? "";
          r.lastSpoken = undefined;
          await runToolCalls(calls, spoken);
          return;
        }
        // Session limits arrive as events right before a normal (1000) close.
        case "session.idle_timeout":
          setError("The call ended after 5 minutes of silence. Press Call again whenever you're ready.");
          return;
        case "session.max_duration_reached":
          setError("This call reached its maximum length. Press Call again to keep talking.");
          return;
        case "error":
          console.warn("[realtime] error event", event.error);
          if (/cancel|no active response/i.test(event.error?.message ?? "")) return;
          setError(event.error?.message ?? "Realtime error");
          return;
      }
    },
    [cutOff, fail, followLanguage, observe, runToolCalls, send, upsertLine],
  );

  const connectLeg = useCallback(
    async (personaId: PersonaId, handoff?: Handoff) => {
      const r = res.current;
      r.personaId = personaId;
      r.legReady = false;
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId,
          userName: r.userName,
          greetedWith: r.greetedWith,
          callId: r.callId,
          language: r.language,
          pushToTalk: r.pushToTalk,
          handoff,
        }),
      });
      const body = (await response.json()) as SessionResponse & { error?: string; callId?: number };
      if (!response.ok) throw new Error(body.error ?? `Session failed (${response.status})`);
      r.callId ??= body.callId;
      if (res.current !== r) return; // hung up while connecting

      const ws = new WebSocket(body.url, ["realtime", `bai-client-secret.${body.clientSecret}`]);
      r.ws = ws;
      r.baseInstructions = String(body.session.instructions ?? "");
      const session =
        r.language === "auto" && r.spokenLang !== "en"
          ? { ...body.session, instructions: r.baseInstructions + LANGUAGE_OVERRIDE[r.spokenLang] }
          : body.session;
      ws.onopen = () => ws.send(JSON.stringify({ type: "session.update", session }));
      ws.onmessage = (msg) => {
        try {
          void handleEvent(JSON.parse(msg.data as string) as ServerEvent, ws);
        } catch (err) {
          console.warn("[realtime] bad event", err);
        }
      };
      ws.onclose = (e) => {
        if (res.current.ws !== ws) return; // an old leg closing after a handoff
        const clean = e.code === 1000;
        if (!clean) {
          const reason: Record<number, string> = {
            3000: "Boson rejected the key (code 3000).",
            1013: "Too many calls at once. Try again in a moment.",
            4429: "The Boson balance or spending cap was reached.",
          };
          setError(reason[e.code] ?? `Call dropped (code ${e.code}).`);
        }
        setStatus(clean ? "ended" : "error");
        teardown();
      };
    },
    [handleEvent, teardown],
  );
  useEffect(() => {
    connectLegRef.current = connectLeg;
  }, [connectLeg]);

  const start = useCallback(
    async (
      personaId: PersonaId,
      userName?: string,
      greeting?: string,
      language: LanguageMode = "auto",
      pushToTalk = false,
    ) => {
      teardown();
      setError(null);
      setLines(greeting ? [{ id: "greeting", role: "assistant", text: greeting, final: true }] : []);
      setStatus("connecting");
      try {
        const ctx = new AudioContext({ sampleRate: 24000 });
        await ctx.resume();
        // If Chrome pauses the context (headset or device switch), mic capture stops silently: resume it.
        ctx.onstatechange = () => {
          if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
        };
        const r = res.current;
        r.ctx = ctx;
        r.userName = userName || undefined;
        r.language = language;
        r.pushToTalk = pushToTalk;
        r.greetedWith = greeting;
        r.greetingPlaying = Boolean(greeting);
        // Safety net: if the clip never reports ending (autoplay blocked, decode stall), un-mute anyway.
        if (greeting) setTimeout(() => (r.greetingPlaying = false), 12_000);
        r.player = new PcmPlayer(ctx, setAiSpeaking);
        await connectLeg(personaId);
      } catch (err) {
        setError((err as Error).message);
        setStatus("error");
        teardown();
      }
    },
    [connectLeg, teardown],
  );

  /** Typed message: same conversation, for noisy rooms or when the mic is off. */
  const sendText = useCallback(
    (text: string) => {
      const r = res.current;
      const clean = text.trim();
      if (!clean || !r.ws || r.ws.readyState !== WebSocket.OPEN) return;
      if (findAbuse(clean)) {
        cutOff(clean, `typed-${Date.now()}`);
        return;
      }
      if (r.player?.active) {
        // Typing over the companion works like talking over it.
        r.player.stop();
        if (r.speakingItemId) r.interruptedItems.add(r.speakingItemId);
        send({ type: "response.cancel" });
      }
      followLanguage(clean);
      setLines((prev) => [...prev, { id: `typed-${Date.now()}`, role: "user", text: clean, final: true }]);
      send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: clean }] } });
      send({ type: "response.create" });
      setThinking(true);
      observe(clean, r.personaId ?? "");
    },
    [cutOff, followLanguage, observe, send],
  );

  /** Push to talk: start a turn. Talking over the companion interrupts it. */
  const pttStart = useCallback(() => {
    const r = res.current;
    if (!r.pushToTalk || r.pttHeld || !r.ws || r.ws.readyState !== WebSocket.OPEN) return;
    if (r.player?.active) {
      r.player.stop();
      if (r.speakingItemId) {
        const id = r.speakingItemId;
        r.interruptedItems.add(id);
        upsertLine(id, (prev) => ({ ...(prev ?? { id, role: "assistant", text: "" }), interrupted: true, final: true }));
      }
      send({ type: "response.cancel" });
    }
    r.speakingItemId = undefined;
    r.greetingPlaying = false;
    send({ type: "input_audio_buffer.clear" });
    for (const chunk of r.preRoll) send({ type: "input_audio_buffer.append", audio: bytesToBase64(chunk) });
    r.preRoll = [];
    r.turnStartedAt = performance.now();
    r.turnMaxLevel = 0;
    setHint(null);
    r.pttHeld = true;
    setUserSpeaking(true);
  }, [send, upsertLine]);

  /** Push to talk: end the turn and ask for the reply right away. */
  const pttEnd = useCallback(() => {
    const r = res.current;
    if (!r.pttHeld) return;
    r.pttHeld = false;
    setUserSpeaking(false);
    // Never send silence: STT hallucinates on it (e.g. random Chinese phrases) and the reply is nonsense.
    const tooShort = performance.now() - r.turnStartedAt < 400;
    const noVoice = r.turnMaxLevel < 0.012;
    if (tooShort || noVoice) {
      send({ type: "input_audio_buffer.clear" });
      setHint(
        noVoice
          ? "Didn't catch any voice. Speak closer to the mic, or check the mic in the address bar."
          : "Too short. Keep talking until you're done, then tap or let go.",
      );
      setTimeout(() => setHint(null), 5000);
      return;
    }
    // Let the last audio chunk (up to 40 ms) flush before committing.
    setTimeout(() => {
      send({ type: "input_audio_buffer.commit" });
      setThinking(true);
      if (r.language === "auto") {
        // Reply once we know which language they used; never wait more than 1.5 s.
        r.replyAfterTranscript = true;
        setTimeout(() => {
          if (!r.replyAfterTranscript) return;
          r.replyAfterTranscript = false;
          send({ type: "response.create" });
        }, 1500);
      } else {
        send({ type: "response.create" });
      }
    }, 60);
  }, [send]);

  /** Called when the avatar greeting clip ends (or fails), un-muting the mic. */
  const greetingFinished = useCallback(() => {
    res.current.greetingPlaying = false;
  }, []);

  const hangUp = useCallback(() => {
    teardown();
    setStatus("ended");
  }, [teardown]);

  useEffect(() => {
    window.addEventListener("pagehide", teardown);
    return () => {
      window.removeEventListener("pagehide", teardown);
      teardown();
    };
  }, [teardown]);

  return {
    status,
    error,
    lines,
    aiSpeaking,
    userSpeaking,
    thinking,
    micLevel,
    hint,
    start,
    hangUp,
    sendText,
    greetingFinished,
    pttStart,
    pttEnd,
  };
}
