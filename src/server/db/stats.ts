import "server-only";
import type { Mood } from "@/shared/moods";
import type { Usage } from "@/shared/pricing";
import { getPool } from "./pool";

export interface UserStats {
  calls: number;
  checkIns: number;
  nudges: number;
  avgIntensity: number | null;
  moodCounts: { mood: Mood; count: number }[];
  usage: Usage;
}

/** Dashboard totals computed in SQL, so they are not capped by the list queries. */
export async function getUserStats(userId: string): Promise<UserStats> {
  const pool = getPool();
  const noUsage = { inputTokens: 0, outputTokens: 0, cachedTokens: 0, callSeconds: 0 };
  if (!pool) return { calls: 0, checkIns: 0, nudges: 0, avgIntensity: null, moodCounts: [], usage: noUsage };
  const [totals, moods, usage] = await Promise.all([
    pool.query<{ calls: string; check_ins: string; nudges: string; avg_intensity: string | null }>(
      `SELECT
         (SELECT count(*) FROM calls WHERE user_id = $1 AND ended_at IS NOT NULL) AS calls,
         (SELECT count(*) FROM moods WHERE user_id = $1) AS check_ins,
         (SELECT count(*) FROM nudges WHERE user_id = $1) AS nudges,
         (SELECT avg(intensity) FROM moods WHERE user_id = $1) AS avg_intensity`,
      [userId],
    ),
    pool.query<{ mood: Mood; count: string }>(
      "SELECT mood, count(*) AS count FROM moods WHERE user_id = $1 GROUP BY mood ORDER BY count(*) DESC, mood",
      [userId],
    ),
    pool.query<{ input: string; output: string; cached: string; seconds: string }>(
      `SELECT coalesce(sum(input_tokens), 0) AS input, coalesce(sum(output_tokens), 0) AS output,
              coalesce(sum(cached_tokens), 0) AS cached,
              coalesce(sum(extract(epoch FROM ended_at - started_at)), 0) AS seconds
       FROM calls WHERE user_id = $1 AND ended_at IS NOT NULL`,
      [userId],
    ),
  ]);
  const u = usage.rows[0];
  const t = totals.rows[0];
  return {
    calls: Number(t.calls),
    checkIns: Number(t.check_ins),
    nudges: Number(t.nudges),
    avgIntensity: t.avg_intensity === null ? null : Number(t.avg_intensity),
    moodCounts: moods.rows.map((r) => ({ mood: r.mood, count: Number(r.count) })),
    usage: {
      inputTokens: Number(u.input),
      outputTokens: Number(u.output),
      cachedTokens: Number(u.cached),
      callSeconds: Number(u.seconds),
    },
  };
}
