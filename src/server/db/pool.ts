import "server-only";
import { Pool } from "pg";
import { databaseUrl } from "@/server/env";

// One pool per server process; survives Next.js dev hot reloads via globalThis.
const globalForPg = globalThis as unknown as { pgPool?: Pool };

export function getPool(): Pool | null {
  const url = databaseUrl();
  if (!url) return null;
  if (!globalForPg.pgPool) {
    globalForPg.pgPool = new Pool({
      connectionString: url,
      max: 5,
      // InstaCloud Postgres scales to zero; drop idle clients before it suspends.
      idleTimeoutMillis: 10_000,
    });
    // An idle client dropped by a DB suspend must not crash the process.
    globalForPg.pgPool.on("error", (err) => console.error("[pg] idle client error", err.message));
  }
  return globalForPg.pgPool;
}
