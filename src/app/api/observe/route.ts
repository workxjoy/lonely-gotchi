import { z } from "zod";
import { findAbuse } from "@/shared/moderation";
import { runListener } from "@/server/companion/listener";
import { userFromRequest } from "@/server/session";
import { rateLimited } from "@/server/rate-limit";

const bodySchema = z.object({ text: z.string().min(1).max(2000), personaId: z.string() });

// Runs the Listener agent on one user utterance (called by the browser after each transcribed turn).
export async function POST(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return Response.json({ actions: [], error: "Please sign in." }, { status: 401 });
  if (rateLimited(user.id, "observe", 60, 10 * 60_000)) {
    return Response.json({ actions: [], error: "Rate limited" }, { status: 429 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  if (findAbuse(parsed.data.text)) return Response.json({ actions: [], blocked: true });
  try {
    const actions = await runListener(parsed.data.text, { userId: user.id, persona: parsed.data.personaId });
    return Response.json({ actions });
  } catch (err) {
    console.error("[observe]", err);
    return Response.json({ actions: [], error: (err as Error).message }, { status: 502 });
  }
}
