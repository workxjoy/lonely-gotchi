import "server-only";
import type { Mood, MoodEntry } from "@/shared/moods";
import { getPool } from "./pool";

interface MoodRow {
  id: number;
  persona: string;
  mood: Mood;
  intensity: number;
  note: string | null;
  created_at: Date;
}

const toEntry = (r: MoodRow): MoodEntry => ({
  id: r.id,
  persona: r.persona,
  mood: r.mood,
  intensity: r.intensity,
  note: r.note,
  createdAt: r.created_at.toISOString(),
});

/** Inserts unless the same mood and intensity was logged in the last 2 minutes (models sometimes repeat the call). */
export async function insertMood(
  userId: string,
  input: { persona: string; mood: Mood; intensity: number; note?: string },
): Promise<MoodEntry | null> {
  const pool = getPool();
  if (!pool) throw new Error("Database not configured");
  const { rows } = await pool.query<MoodRow>(
    `INSERT INTO moods (user_id, persona, mood, intensity, note)
     SELECT $1, $2, $3, $4, $5
     WHERE NOT EXISTS (
       SELECT 1 FROM moods
       WHERE user_id = $1 AND mood = $3 AND intensity = $4 AND created_at > now() - interval '2 minutes'
     )
     RETURNING id, persona, mood, intensity, note, created_at`,
    [userId, input.persona, input.mood, input.intensity, input.note ?? null],
  );
  return rows[0] ? toEntry(rows[0]) : null;
}

export async function listRecentMoods(userId: string, limit = 20): Promise<MoodEntry[]> {
  const pool = getPool();
  if (!pool) return [];
  const { rows } = await pool.query<MoodRow>(
    `SELECT id, persona, mood, intensity, note, created_at
     FROM moods WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit],
  );
  return rows.map(toEntry);
}
