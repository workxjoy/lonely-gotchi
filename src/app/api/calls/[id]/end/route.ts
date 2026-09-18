import { z } from "zod";
import { redactAbuse } from "@/shared/moderation";
import { endCall, saveCallSummary } from "@/server/db/calls";
import { summarizeCall } from "@/server/companion/summarizer";
import { userFromRequest } from "@/server/session";

const bodySchema = z.object({
  lines: z
    .array(z.object({ role: z.enum(["user", "assistant", "system"]), text: z.string().transform((s) => s.slice(0, 2000)) }))
    .transform((a) => a.slice(-400)),
  usage: z
    .object({
      input_tokens: z.number().int().nonnegative(),
      output_tokens: z.number().int().nonnegative(),
      cached_tokens: z.number().int().nonnegative(),
    })
    .optional(),
});

// Ends a call: stores the transcript, then runs the summarizer agent (learning loop).
export async function POST(request: Request, ctx: RouteContext<"/api/calls/[id]/end">) {
  const user = await userFromRequest(request);
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });
  const callId = Number((await ctx.params).id);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(callId) || !parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const lines = parsed.data.lines.filter((l) => l.text.trim()).map((l) => ({ ...l, text: redactAbuse(l.text) }));
  try {
    if (!(await endCall(user.id, callId, lines, parsed.data.usage))) return Response.json({ ok: false }, { status: 404 });
  } catch (err) {
    console.error("[calls:end]", err);
    return Response.json({ ok: false }, { status: 500 });
  }
  try {
    await summarizeCall(user.id, callId, lines);
  } catch (err) {
    // The call and transcript are saved; don't leave the dashboard waiting on a summary forever.
    console.error("[calls:summarize]", err);
    await saveCallSummary(callId, "We couldn't summarize this call, but the transcript is saved.", null).catch(() => undefined);
  }
  return Response.json({ ok: true });
}
