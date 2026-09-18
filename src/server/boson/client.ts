import "server-only";
import { requireBosonKey } from "@/server/env";

const BOSON_API = "https://api.boson.ai";

export const REALTIME_URL = "wss://api.boson.ai/v1/realtime?model=higgs-realtime";

/** Mint a short-lived key the browser uses to open the Realtime WebSocket directly. */
export async function createClientSecret(ttlSeconds = 600): Promise<string> {
  const res = await fetch(`${BOSON_API}/v1/realtime/client_secrets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireBosonKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expires_after: { seconds: ttlSeconds } }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Boson client secret failed (${res.status}): ${await res.text()}`);
  }
  const body = (await res.json()) as { value: string };
  return body.value;
}
