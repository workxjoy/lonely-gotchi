import "server-only";
import type { CallEntry, CallLine } from "@/shared/moods";
import { getPool } from "./pool";

function pool() {
  const p = getPool();
  if (!p) throw new Error("Database not configured");
  return p;
}

export async function createCall(userId: string, persona: string): Promise<number> {
  const { rows } = await pool().query<{ id: number }>(
    "INSERT INTO calls (user_id, persona) VALUES ($1, $2) RETURNING id",
    [userId, persona],
  );
  return rows[0].id;
}

/** Stores the transcript and closes the call. Returns false if the call is not this user's or already ended. */
export async function endCall(
  userId: string,
  callId: number,
  lines: CallLine[],
  usage?: { input_tokens: number; output_tokens: number; cached_tokens: number },
): Promise<boolean> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const { rowCount } = await client.query(
      `UPDATE calls SET ended_at = now(), input_tokens = $3, output_tokens = $4, cached_tokens = $5
       WHERE id = $1 AND user_id = $2 AND ended_at IS NULL`,
      [callId, userId, usage?.input_tokens ?? 0, usage?.output_tokens ?? 0, usage?.cached_tokens ?? 0],
    );
    if (!rowCount) {
      await client.query("ROLLBACK");
      return false;
    }
    for (const [position, line] of lines.entries()) {
      await client.query("INSERT INTO call_messages (call_id, position, role, text) VALUES ($1, $2, $3, $4)", [
        callId,
        position,
        line.role,
        line.text,
      ]);
    }
    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function saveCallSummary(callId: number, summary: string, whatHelped: string | null): Promise<void> {
  await pool().query("UPDATE calls SET summary = $2, what_helped = $3 WHERE id = $1", [callId, summary, whatHelped]);
}

interface CallRow {
  id: number;
  persona: string;
  started_at: Date;
  ended_at: Date | null;
  summary: string | null;
  what_helped: string | null;
}

/** Most recent finished calls, newest first, with transcripts when `withLines` is set. */
export async function listRecentCalls(userId: string, limit = 10, withLines = false): Promise<CallEntry[]> {
  const p = getPool();
  if (!p) return [];
  const { rows } = await p.query<CallRow>(
    `SELECT id, persona, started_at, ended_at, summary, what_helped FROM calls
     WHERE user_id = $1 AND ended_at IS NOT NULL ORDER BY started_at DESC LIMIT $2`,
    [userId, limit],
  );
  const lines = new Map<number, CallLine[]>();
  if (withLines && rows.length) {
    const res = await p.query<{ call_id: number; role: CallLine["role"]; text: string }>(
      "SELECT call_id, role, text FROM call_messages WHERE call_id = ANY($1) ORDER BY call_id, position",
      [rows.map((r) => r.id)],
    );
    for (const r of res.rows) lines.set(r.call_id, [...(lines.get(r.call_id) ?? []), { role: r.role, text: r.text }]);
  }
  return rows.map((r) => ({
    id: r.id,
    persona: r.persona,
    startedAt: r.started_at.toISOString(),
    endedAt: r.ended_at?.toISOString() ?? null,
    summary: r.summary,
    whatHelped: r.what_helped,
    lines: lines.get(r.id) ?? [],
  }));
}
