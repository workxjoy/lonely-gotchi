import "server-only";
import { runTextTurn } from "@/server/boson/realtime-text";
import { executeTool, isToolName, LISTENER_TOOLS } from "./tools";

const LISTENER_INSTRUCTIONS = `You are the Listener: a silent note-taker for a voice companion app. You never chat.
For the user's latest message, call EVERY tool that applies, all in one response:
- log_mood if the message expresses or implies any feeling, positive or negative ("good", "great", "fine" count: use happy, calm or grateful).
- remember once per concrete fact (a person, an upcoming event, a worry, a win).
- suggest_reach_out if they mention someone they love or miss, or sound lonely. The message is a short, warm text written as the user to that person.
If no tool applies, reply with the single word: none.`;

export interface ListenerAction {
  name: string;
  args: unknown;
  ok: boolean;
}

/** Background agent: reads one user utterance and records moods, memories and Bridge nudges. */
export async function runListener(
  utterance: string,
  ctx: { userId: string; persona: string },
): Promise<ListenerAction[]> {
  const calls = await runTextTurn({ instructions: LISTENER_INSTRUCTIONS, tools: LISTENER_TOOLS, message: utterance });
  const actions: ListenerAction[] = [];
  for (const call of calls) {
    if (!isToolName(call.name)) continue;
    try {
      const args = JSON.parse(call.arguments);
      await executeTool(call.name, args, ctx);
      actions.push({ name: call.name, args, ok: true });
    } catch (err) {
      console.error(`[listener:${call.name}]`, err);
      actions.push({ name: call.name, args: call.arguments, ok: false });
    }
  }
  return actions;
}
