import { z } from "zod";
import { isLanguageMode } from "@/shared/languages";
import { getPersona } from "@/shared/personas";
import { createClientSecret, REALTIME_URL } from "@/server/boson/client";
import { buildInstructions } from "@/server/companion/instructions";
import { resolveVoice } from "@/server/companion/voices";
import { VOICE_TOOLS } from "@/server/companion/tools";
import { createCall, listRecentCalls } from "@/server/db/calls";
import { listRecentMemories } from "@/server/db/memories";
import { listRecentMoods } from "@/server/db/moods";
import { listRecentNudges } from "@/server/db/nudges";
import { userFromRequest } from "@/server/session";
import { rateLimited } from "@/server/rate-limit";

const bodySchema = z.object({
  personaId: z.string(),
  userName: z.string().max(40).optional(),
  greetedWith: z.string().max(300).optional(),
  callId: z.number().int().optional(),
  language: z.string().optional(),
  pushToTalk: z.boolean().optional(),
  handoff: z
    .object({
      from: z.string(),
      reason: z.string().transform((s) => s.slice(0, 300)),
      recent: z
        .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().transform((s) => s.slice(0, 600)) }))
        .transform((a) => a.slice(-10)),
    })
    .optional(),
});

// Starts a call leg: loads memory, mints a browser-safe key, and returns the full session config.
export async function POST(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });
  if (rateLimited(user.id, "session", 40, 10 * 60_000)) {
    return Response.json({ error: "Too many calls. Try again in a few minutes." }, { status: 429 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  const persona = parsed.success ? getPersona(parsed.data.personaId) : undefined;
  if (!parsed.success) return Response.json({ error: "Invalid session request" }, { status: 400 });
  if (!persona) return Response.json({ error: "Unknown persona" }, { status: 400 });
  const { handoff, userName, greetedWith } = parsed.data;
  const language = isLanguageMode(parsed.data.language) ? parsed.data.language : "auto";

  const [moods, memories, nudges, calls] = await Promise.all([
    listRecentMoods(user.id, 5).catch(() => []),
    listRecentMemories(user.id, 8).catch(() => []),
    listRecentNudges(user.id, 3).catch(() => []),
    listRecentCalls(user.id, 3).catch(() => []),
  ]);
  // A handoff continues the same call; a fresh call gets its own log.
  const callId = parsed.data.callId ?? (await createCall(user.id, persona.id).catch(() => undefined));

  try {
    const clientSecret = await createClientSecret();
    return Response.json({
      url: REALTIME_URL,
      clientSecret,
      callId,
      session: {
        model: "higgs-realtime",
        instructions: buildInstructions(persona, { moods, memories, nudges, calls }, { handoff, userName, greetedWith, language }),
        audio: {
          input: {
            format: { type: "audio/pcm", rate: 24000 },
            // Push to talk: the browser commits each turn on release, so background noise can't stall it.
            turn_detection: parsed.data.pushToTalk
              ? null
              : { type: "server_vad", threshold: 0.6, prefix_padding_ms: 800, silence_duration_ms: 700 },
            transcription:
              language === "hi" || language === "zh" ? { model: "higgs-stt-3.1", language } : { model: "higgs-stt-3.1" },
            noise_reduction: { type: "far_field" }, // laptop mics; near_field stripped distant voices
          },
          output: {
            format: { type: "audio/pcm", rate: 24000 },
            voice: resolveVoice(persona),
          },
        },
        tools: VOICE_TOOLS,
        tool_choice: "auto",
      },
    });
  } catch (err) {
    console.error("[session]", err);
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
