"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CallStatus, CaptionLine } from "@/features/call/types";

interface Props {
  status: CallStatus;
  error: string | null;
  lines: CaptionLine[];
  personaName: string;
  aiSpeaking: boolean;
  userSpeaking: boolean;
  thinking: boolean;
  onCall: () => void;
  onHangUp: () => void;
  onSend: (text: string) => void;
  /** Face shown beside the captions (video-call layout). */
  avatar?: ReactNode;
  pushToTalk: boolean;
  onTalkStart: () => void;
  onTalkEnd: () => void;
}

function liveHint(aiSpeaking: boolean, userSpeaking: boolean, thinking: boolean): string {
  if (userSpeaking) return "Hearing you...";
  if (aiSpeaking) return "Speaking. Talk over it any time.";
  if (thinking) return "Thinking...";
  return "Your mic is live. Just talk, or type below.";
}

const STATUS_LABEL: Record<CallStatus, string> = {
  idle: "Ready when you are",
  connecting: "Calling...",
  live: "On the call",
  ended: "Call ended",
  error: "Something went wrong",
};

export function CallPanel({
  status,
  error,
  lines,
  personaName,
  aiSpeaking,
  userSpeaking,
  thinking,
  onCall,
  onHangUp,
  onSend,
  avatar,
  pushToTalk,
  onTalkStart,
  onTalkEnd,
}: Props) {
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  const inCall = status === "connecting" || status === "live";

  // Space bar = hold to talk (ignored while typing in the message box).
  useEffect(() => {
    if (!pushToTalk || status !== "live") return;
    const typing = (e: KeyboardEvent) => (e.target as HTMLElement | null)?.tagName === "INPUT";
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || typing(e)) return;
      e.preventDefault();
      onTalkStart();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" || typing(e)) return;
      e.preventDefault();
      onTalkEnd();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [pushToTalk, status, onTalkStart, onTalkEnd]);

  return (
    <section className="flex h-full flex-col rounded-3xl bg-[var(--card)] p-5">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-[var(--muted)]">{STATUS_LABEL[status]}</div>
          <div className="text-lg font-semibold">{personaName}</div>
        </div>
        {inCall ? (
          <button
            type="button"
            onClick={onHangUp}
            className="rounded-full bg-[#e5484d] px-6 py-3 font-semibold text-white transition hover:brightness-110"
          >
            Hang up
          </button>
        ) : (
          <button
            type="button"
            onClick={onCall}
            className="rounded-full bg-[var(--accent)] px-6 py-3 font-semibold text-[#2a1a12] transition hover:brightness-110"
          >
            {status === "ended" ? "Call again" : "Call"}
          </button>
        )}
      </header>

      {status === "live" && (
        <p className="mb-3 flex items-center gap-2 text-sm text-[var(--muted)]">
          <span
            className={`h-2.5 w-2.5 rounded-full ${userSpeaking ? "bg-[#7dd3a8] animate-pulse" : aiSpeaking ? "bg-[var(--accent)] animate-pulse" : "bg-[#7dd3a8]"}`}
          />
          {pushToTalk && !userSpeaking && !aiSpeaking && !thinking
            ? "Hold the button (or Space) while you talk, then let go."
            : liveHint(aiSpeaking, userSpeaking, thinking)}
        </p>
      )}

      {error && <p className="mb-3 rounded-xl bg-[#3a1d24] px-3 py-2 text-sm text-[#ffb3bd]">{error}</p>}

      <div className="flex min-h-0 flex-1 flex-col gap-4 sm:flex-row">
      {avatar && <div className="flex shrink-0 justify-center sm:block">{avatar}</div>}
      <div ref={scroller} className="max-h-[440px] min-h-64 flex-1 space-y-3 overflow-y-auto pr-1">
        {lines.length === 0 && (
          <p className="text-sm text-[var(--muted)]">
            {inCall ? "Connecting your voice..." : "Press Call. Use headphones so it doesn't hear itself."}
          </p>
        )}
        {lines.map((line) =>
          line.role === "system" ? (
            <div key={line.id} className="flex justify-center">
              <span className="fade-in rounded-full bg-[#3b2a1f] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                {line.text}
              </span>
            </div>
          ) : (
          <div key={line.id} className={line.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 text-[15px] leading-relaxed ${
                line.role === "user" ? "bg-[var(--user-bubble)]" : "bg-[var(--card-strong)]"
              } ${line.final ? "" : "opacity-70"}`}
            >
              {line.text || "..."}
              {line.interrupted && (
                <span className="ml-2 rounded-full bg-[#4a3350] px-2 py-0.5 text-xs text-[#f0c6ff]">interrupted</span>
              )}
            </div>
          </div>
          ),
        )}
      </div>
      </div>

      {status === "live" && pushToTalk && (
        <button
          type="button"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            onTalkStart();
          }}
          onPointerUp={onTalkEnd}
          onPointerCancel={onTalkEnd}
          className={`mt-4 w-full select-none rounded-2xl py-4 text-lg font-semibold transition ${
            userSpeaking ? "bg-[#7dd3a8] text-[#10261b]" : "bg-[var(--card-strong)] text-[var(--foreground)] hover:brightness-125"
          }`}
        >
          {userSpeaking ? "Listening... let go to send" : "Hold to talk"}
        </button>
      )}

      {status === "live" && (
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSend(draft);
            setDraft("");
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message if you can't talk right now"
            className="flex-1 rounded-full border border-transparent bg-[var(--card-strong)] px-5 py-3 text-[15px] outline-none focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="rounded-full bg-[var(--accent)] px-5 py-3 font-semibold text-[#2a1a12] disabled:opacity-40"
          >
            Send
          </button>
        </form>
      )}
    </section>
  );
}
