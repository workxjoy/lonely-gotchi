// Better Auth: email + password accounts, sessions stored in InstaCloud Postgres.
// No "server-only" import here: the Better Auth CLI loads this file to generate the schema.
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  // InstaCloud Postgres scales to zero; drop idle clients before it suspends.
  idleTimeoutMillis: 10_000,
});
// An idle client dropped by a DB suspend must not crash the process.
pool.on("error", (err) => console.error("[auth pg] idle client error", err.message));

export const auth = betterAuth({
  appName: "lonely-gotchi",
  database: pool,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh daily
  },
  // nextCookies must be last: it sets cookies from server actions and route handlers.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
