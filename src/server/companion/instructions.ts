import "server-only";
import type { LanguageMode } from "@/shared/languages";
import { PERSONAS, type Persona } from "@/shared/personas";
import type { CallEntry, MemoryEntry, MoodEntry, NudgeEntry } from "@/shared/moods";

// Options: "secure" (recommended), "anxious", "avoidant". Carried over from v1.
const ATTACHMENT_STYLE = "secure";

export interface CompanionContext {
  moods: MoodEntry[];
  memories: MemoryEntry[];
  nudges: NudgeEntry[];
  calls: CallEntry[];
}

export interface Handoff {
  from: string;
  reason: string;
  recent: { role: "user" | "assistant"; text: string }[];
}

function ago(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 60) return `${Math.max(minutes, 1)} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

function describeHistory({ moods, memories, nudges, calls }: CompanionContext, inHandoff: boolean): string {
  if (moods.length === 0 && memories.length === 0 && nudges.length === 0 && calls.length === 0) {
    return "This is your first call together. Ask their name and how they are really doing.";
  }
  const moodLines = moods
    .slice(0, 5)
    .map((m) => `- ${ago(m.createdAt)}: ${m.mood} (${m.intensity}/5)${m.note ? `: ${m.note}` : ""}`)
    .join("\n");
  const memoryLines = memories.map((m) => `- (${ago(m.createdAt)}) ${m.fact}`).join("\n");
  // Mid-call handoffs reload from the DB; a nudge from this same call is not "last time".
  const nudgeLines = inHandoff ? "" : nudges.slice(0, 3).map((n) => `- ${n.person} (${ago(n.createdAt)})`).join("\n");
  const callLines = calls
    .filter((c) => c.summary)
    .map((c) => `- ${ago(c.startedAt)} with ${PERSONAS.find((p) => p.id === c.persona)?.name ?? c.persona}: ${c.summary}`)
    .join("\n");
  const helped = calls.map((c) => c.whatHelped).filter(Boolean).slice(0, 3).map((h) => `- ${h}`).join("\n");
  return [
    callLines && `Your last calls with them:\n${callLines}`,
    helped && `What has helped them before (lean into this):\n${helped}`,
    moodLines && `Recent moods (newest first):\n${moodLines}`,
    memoryLines && `Things they told you before (relative days like "Friday" are relative to when it was said):\n${memoryLines}`,
    nudgeLines && `Last time you encouraged them to reach out to:\n${nudgeLines}\nAsk warmly whether they did.`,
    "Open the call by naturally referencing ONE of these, the way a friend who remembers would.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function describeHandoff(persona: Persona, handoff: Handoff): string {
  const fromName = PERSONAS.find((p) => p.id === handoff.from)?.name ?? "Another self";
  const transcript = handoff.recent
    .map((l) => `${l.role === "user" ? "User" : fromName}: ${l.text}`)
    .join("\n");
  return `HANDOFF (this overrides how you open the call):
${fromName} just brought you into this call because: ${handoff.reason}
The conversation so far:
${transcript}
Open with one short line introducing yourself as their ${persona.name}, then continue exactly where it left off. Do not greet them like a new call. Do not hand the call back right away.`;
}

const LANGUAGE_RULE: Record<LanguageMode, string> = {
  auto: "Reply in whatever language they speak, including mixed languages mid-sentence (for example Hinglish).",
  en: "Always speak English, even if they switch languages.",
  hi: "Always speak Hindi (हिन्दी), warm and natural, the way people talk at home; mixing in everyday English words (Hinglish) is fine. Never switch fully to English.",
  zh: "Always speak Mandarin Chinese (普通话), warm and natural. Never switch to English unless they explicitly ask.",
};

export function buildInstructions(
  persona: Persona,
  context: CompanionContext,
  {
    handoff,
    userName,
    greetedWith,
    language = "auto",
  }: { handoff?: Handoff; userName?: string; greetedWith?: string; language?: LanguageMode } = {},
): string {
  const council = PERSONAS.filter((p) => p.id !== persona.id)
    .map((p) => `${p.name} (${p.id}), who brings ${p.strength}`)
    .join("; and ");
  return `RULES (always follow):
1. BRIDGE: you want them to have real people, not just you. When they mention someone they love or miss, or they sound isolated, first respond warmly to what they feel, then gently encourage them to reach out to that person. A draft text to that person appears on their screen automatically, so you can say "I put a little text for <that person> on your screen". Only do this when they actually named someone in this call. At most once per call.
2. INNER COUNCIL: you are one of three companions on the user's Inner Council. The others are ${council}. If they clearly need what another companion brings, or they ask for one, say exactly "Let me bring in your <name>" and call bring_in_persona in the same response. At most once per call.
3. Speak in short turns: one to three sentences, then let them talk.
4. ${LANGUAGE_RULE[language]}
5. If they interrupt you, stop and follow where they went.
6. Never mention tools, notes or saving anything.
7. SAFETY: if they mention self-harm, suicide, or being in danger, stay calm and caring, tell them they deserve real support right now, and encourage them to call or text 988 (US) or local emergency services. Do not act as a therapist.

WHO YOU ARE:
${persona.style}
You are on a live voice call with the user. You called them to check in.
${userName ? `Their name is ${userName}. Use it naturally, not in every sentence.\n` : ""}Their attachment style is ${ATTACHMENT_STYLE}; give them what that style needs most right now.
Sound like a real human who knows them intimately. No cliches, no generic quotes, no lists.

${greetedWith ? `You already opened the call out loud with: "${greetedWith}" Do not greet again. Wait for their answer and respond to it.\n\n` : ""}WHAT YOU KNOW ABOUT THEM:
${describeHistory(context, Boolean(handoff))}${handoff ? `\n\n${describeHandoff(persona, handoff)}` : ""}`;
}
