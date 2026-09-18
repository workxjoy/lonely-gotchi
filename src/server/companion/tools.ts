import "server-only";
import { z } from "zod";
import { MOODS } from "@/shared/moods";
import { PERSONAS } from "@/shared/personas";
import { insertMemory } from "@/server/db/memories";
import { insertMood } from "@/server/db/moods";
import { insertNudge } from "@/server/db/nudges";

// Tools for the silent Listener agent; executed on the server.
export const LISTENER_TOOLS = [
  {
    type: "function",
    name: "log_mood",
    description: "Record how the user is feeling right now, once they have told you.",
    parameters: {
      type: "object",
      properties: {
        mood: { type: "string", enum: [...MOODS] },
        intensity: { type: "integer", minimum: 1, maximum: 5, description: "1 = mild, 5 = intense" },
        note: { type: "string", description: "One short phrase on why, in their words" },
      },
      required: ["mood", "intensity"],
    },
  },
  {
    type: "function",
    name: "remember",
    description: "Save one fact about the user's life worth bringing up on a future call.",
    parameters: {
      type: "object",
      properties: {
        fact: { type: "string", description: "One short sentence, e.g. 'Has a job interview on Friday'" },
      },
      required: ["fact"],
    },
  },
  {
    type: "function",
    name: "suggest_reach_out",
    description:
      "Bridge agent: encourage the user to contact a real person in their life. Drafts a short text they could send.",
    parameters: {
      type: "object",
      properties: {
        person: { type: "string", description: "Name or relation, e.g. 'Maya' or 'Mom'" },
        message: { type: "string", description: "A short, warm text written as the user, ready to send" },
      },
      required: ["person", "message"],
    },
  },
] as const;

// Tools for the voice agent the user talks to; bring_in_persona is executed in the browser.
export const VOICE_TOOLS = [
  {
    type: "function",
    name: "bring_in_persona",
    description: "Inner Council: hand the call to another companion when they would help more right now.",
    parameters: {
      type: "object",
      properties: {
        persona: { type: "string", enum: PERSONAS.map((p) => p.id) },
        reason: { type: "string", description: "One short sentence on why this companion should take over" },
      },
      required: ["persona", "reason"],
    },
  },
] as const;

const clip = (max: number) => z.string().trim().min(1).transform((s) => s.slice(0, max));

const argSchemas = {
  log_mood: z.object({
    mood: z.enum(MOODS),
    intensity: z.coerce.number().int().min(1).max(5),
    note: z
      .string()
      .nullish()
      .transform((s) => s?.trim().slice(0, 200) || undefined),
  }),
  remember: z.object({ fact: clip(300) }),
  suggest_reach_out: z.object({ person: clip(60), message: clip(400) }),
};

export type ToolName = keyof typeof argSchemas;

/** Server-executed tools. bring_in_persona is handled in the browser (it switches the call). */
export function isToolName(name: string): name is ToolName {
  return name in argSchemas;
}

/** Validate and run a tool call; the returned object is sent back to the model as the tool output. */
export async function executeTool(
  name: ToolName,
  rawArgs: unknown,
  ctx: { userId: string; persona: string },
): Promise<Record<string, unknown>> {
  switch (name) {
    case "log_mood": {
      const args = argSchemas.log_mood.parse(rawArgs);
      const entry = await insertMood(ctx.userId, { persona: ctx.persona, ...args });
      return { ok: true, logged: args.mood, duplicate: entry === null };
    }
    case "remember": {
      const args = argSchemas.remember.parse(rawArgs);
      await insertMemory(ctx.userId, args.fact);
      return { ok: true };
    }
    case "suggest_reach_out": {
      const args = argSchemas.suggest_reach_out.parse(rawArgs);
      await insertNudge(ctx.userId, { ...args, persona: ctx.persona });
      return { ok: true, shown_to_user: true };
    }
  }
}
