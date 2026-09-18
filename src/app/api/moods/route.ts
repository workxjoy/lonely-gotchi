import { listRecentMemories } from "@/server/db/memories";
import { listRecentMoods } from "@/server/db/moods";
import { listRecentNudges } from "@/server/db/nudges";
import { userFromRequest } from "@/server/session";

export const dynamic = "force-dynamic";

// Timeline feed for the dashboard; the client polls it during and after calls.
export async function GET(request: Request) {
  const user = await userFromRequest(request);
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });
  try {
    const [moods, memories, nudges] = await Promise.all([
      listRecentMoods(user.id, 20),
      listRecentMemories(user.id, 8),
      listRecentNudges(user.id, 5),
    ]);
    return Response.json({ moods, memories, nudges });
  } catch (err) {
    console.error("[moods]", err);
    return Response.json({ error: "Timeline temporarily unavailable" }, { status: 503 });
  }
}
