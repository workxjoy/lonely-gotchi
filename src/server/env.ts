import "server-only";
import { z } from "zod";

// Blank values (e.g. `DATABASE_URL=` placeholders) count as unset instead of failing every route.
const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const schema = z.object({
  BOSON_API_KEY: z.preprocess(blankToUndefined, z.string().optional()),
  DATABASE_URL: z.preprocess(blankToUndefined, z.string().optional()),
});

const env = schema.parse(process.env);

/** Validated at the point of use, so routes that don't need the key keep working without it. */
export function requireBosonKey(): string {
  const key = env.BOSON_API_KEY;
  if (!key) {
    throw new Error("BOSON_API_KEY is not set. Add it to .env.local (never committed), then restart the dev server.");
  }
  if (!key.startsWith("bai-")) {
    throw new Error("BOSON_API_KEY looks wrong: Boson keys start with bai-.");
  }
  return key;
}

export function databaseUrl(): string | undefined {
  return env.DATABASE_URL;
}

