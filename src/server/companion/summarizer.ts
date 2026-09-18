import "server-only";
import type { CallLine } from "@/shared/moods";
import { getPersona } from "@/shared/personas";
import { runTextTurn } from "@/server/boson/realtime-text";
import { saveCallSummary } from "@/server/db/calls";
import { insertMemory } from "@/server/db/memories";

const SUMMARIZER_TOOLS = [
  {
    type: "function",
    name: "save_call_summary",
    description: "Record what this call was about and what helped the user.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Two sentences: what they talked about and how the user was doing." },
        what_helped: {
          type: "string",
          description: "What seemed to help or land well for this user (tone, approach, topic), in one sentence. Empty if unclear.",
        },
      },
      required: ["summary"],
    },
  },
  {
    type: "function",
    name: "remember",
    description: "A durable fact about the user's life worth recalling on future calls.",
    parameters: { type: "object", properties: { fact: { type: "string" } }, required: ["fact"] },
  },
] as const;

const INSTRUCTIONS = `You review a finished call between a user and their companion. You never chat.
Call save_call_summary exactly once. Also call remember once for each durable new fact about the user's life (people, plans, worries, wins) that a friend should recall next time. Do not repeat trivial small talk.`;

/** Learning loop: after a call, store a summary + what helped, and extract durable memories. */
export async function summarizeCall(userId: string, callId: number, lines: CallLine[]): Promise<void> {
  const spoken = lines.filter((l) => l.role !== "system" && l.text.trim());
  if (!spoken.some((l) => l.role === "user")) {
    await saveCallSummary(callId, "A short call; nothing was shared this time.", null); // nothing to learn
    return;
  }
  const transcript = lines
    .map((l) => (l.role === "system" ? `[${l.text}]` : `${l.role === "user" ? "User" : "Companion"}: ${l.text}`))
    .join("\n")
    .slice(-12_000);
  const calls = await runTextTurn({ instructions: INSTRUCTIONS, tools: SUMMARIZER_TOOLS, message: transcript, timeoutMs: 25_000 });
  for (const call of calls) {
    try {
      const args = JSON.parse(call.arguments) as { summary?: string; what_helped?: string; fact?: string };
      if (call.name === "save_call_summary" && args.summary) {
        await saveCallSummary(callId, args.summary.slice(0, 600), args.what_helped?.slice(0, 300) || null);
      }
      if (call.name === "remember" && args.fact) await insertMemory(userId, args.fact.slice(0, 300));
    } catch (err) {
      console.error("[summarizer]", err);
    }
  }
}

export function personaName(id: string) {
  return getPersona(id)?.name ?? id;
}
