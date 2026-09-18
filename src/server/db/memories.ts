import "server-only";
import type { MemoryEntry } from "@/shared/moods";
import { getPool } from "./pool";

interface MemoryRow {
  id: number;
  fact: string;
  created_at: Date;
}

const toEntry = (r: MemoryRow): MemoryEntry => ({
  id: r.id,
  fact: r.fact,
  createdAt: r.created_at.toISOString(),
});

/** Inserts unless this persona already stores the exact same fact. */
export async function insertMemory(userId: string, fact: string, persona?: string): Promise<MemoryEntry | null> {
  const pool = getPool();
  if (!pool) throw new Error("Database not configured");
  const { rows } = await pool.query<MemoryRow>(
    `INSERT INTO memories (user_id, fact, persona)
     SELECT $1, $2, $3
     WHERE NOT EXISTS (
       SELECT 1 FROM memories WHERE user_id = $1 AND persona IS NOT DISTINCT FROM $3 AND lower(fact) = lower($2)
     )
     RETURNING id, fact, created_at`,
    [userId, fact, persona ?? null],
  );
  return rows[0] ? toEntry(rows[0]) : null;
}

/** Newest memories; pass `persona` to get only that companion's own memory. */
export async function listRecentMemories(userId: string, limit = 8, persona?: string): Promise<MemoryEntry[]> {
  const pool = getPool();
  if (!pool) return [];
  const { rows } = await pool.query<MemoryRow>(
    `SELECT id, fact, created_at FROM memories
     WHERE user_id = $1 AND ($3::text IS NULL OR persona = $3) ORDER BY created_at DESC LIMIT $2`,
    [userId, limit, persona ?? null],
  );
  return rows.map(toEntry);
}
