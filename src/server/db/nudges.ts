import "server-only";
import type { NudgeEntry } from "@/shared/moods";
import { getPool } from "./pool";

interface NudgeRow {
  id: number;
  person: string;
  message: string;
  persona: string;
  created_at: Date;
}

const toEntry = (r: NudgeRow): NudgeEntry => ({
  id: r.id,
  person: r.person,
  message: r.message,
  persona: r.persona,
  createdAt: r.created_at.toISOString(),
});

/** Inserts unless the same person was already suggested in the last 10 minutes. */
export async function insertNudge(
  userId: string,
  input: { person: string; message: string; persona: string },
): Promise<NudgeEntry | null> {
  const pool = getPool();
  if (!pool) throw new Error("Database not configured");
  const { rows } = await pool.query<NudgeRow>(
    `INSERT INTO nudges (user_id, person, message, persona)
     SELECT $1, $2, $3, $4
     WHERE NOT EXISTS (
       SELECT 1 FROM nudges
       WHERE user_id = $1 AND lower(person) = lower($2) AND created_at > now() - interval '10 minutes'
     )
     RETURNING id, person, message, persona, created_at`,
    [userId, input.person, input.message, input.persona],
  );
  return rows[0] ? toEntry(rows[0]) : null;
}

/** Newest reach-out drafts; pass `persona` to get only that companion's own. */
export async function listRecentNudges(userId: string, limit = 5, persona?: string): Promise<NudgeEntry[]> {
  const pool = getPool();
  if (!pool) return [];
  const { rows } = await pool.query<NudgeRow>(
    `SELECT id, person, message, persona, created_at FROM nudges
     WHERE user_id = $1 AND ($3::text IS NULL OR persona = $3) ORDER BY created_at DESC LIMIT $2`,
    [userId, limit, persona ?? null],
  );
  return rows.map(toEntry);
}
