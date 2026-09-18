// Mood vocabulary shared by the log_mood tool schema and the UI.

export const MOODS = [
  "happy",
  "grateful",
  "anxious",
  "sad",
  "tired",
  "lonely",
  "overwhelmed",
  "calm",
  "hopeful",
  "confident",
] as const;

export type Mood = (typeof MOODS)[number];

export interface MoodEntry {
  id: number;
  persona: string;
  mood: Mood;
  intensity: number;
  note: string | null;
  createdAt: string;
}

export interface MemoryEntry {
  id: number;
  fact: string;
  createdAt: string;
}

export interface NudgeEntry {
  id: number;
  person: string;
  message: string;
  persona: string;
  createdAt: string;
}

export interface CallLine {
  role: "user" | "assistant" | "system";
  text: string;
}

export interface CallEntry {
  id: number;
  persona: string;
  startedAt: string;
  endedAt: string | null;
  summary: string | null;
  whatHelped: string | null;
  lines: CallLine[];
}
