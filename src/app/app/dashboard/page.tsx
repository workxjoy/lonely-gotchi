import { CallLog } from "@/components/dashboard/CallLog";
import { MoodBars } from "@/components/dashboard/MoodBars";
import { MoodHistory } from "@/components/dashboard/MoodHistory";
import { StatTile } from "@/components/dashboard/StatTile";
import { UsageCard } from "@/components/dashboard/UsageCard";
import { NudgeList } from "@/components/NudgeList";
import { listRecentCalls } from "@/server/db/calls";
import { listRecentMemories } from "@/server/db/memories";
import { listRecentMoods } from "@/server/db/moods";
import { listRecentNudges } from "@/server/db/nudges";
import { getUserStats } from "@/server/db/stats";
import { requireUser } from "@/server/session";

export const dynamic = "force-dynamic";

// Personal dashboard: everything the Listener and Bridge agents have recorded, read straight from Postgres.
export const metadata = { title: "Dashboard | lonely-gotchi" };

export default async function DashboardPage() {
  const user = await requireUser();

  const [moods, memories, nudges, calls, stats] = await Promise.all([
    listRecentMoods(user.id, 200).catch(() => []),
    listRecentMemories(user.id, 50).catch(() => []),
    listRecentNudges(user.id, 20).catch(() => []),
    listRecentCalls(user.id, 10, true).catch(() => []),
    getUserStats(user.id).catch(() => null),
  ]);

  const counts = stats?.moodCounts ?? [];
  const avg = stats?.avgIntensity ?? null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6 md:px-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-[var(--muted)]">
          How you have been, what your companions remember, and who to reach out to.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Calls" value={String(stats?.calls ?? calls.length)} />
        <StatTile label="Check-ins logged" value={String(stats?.checkIns ?? moods.length)} />
        <StatTile label="Most felt" value={counts[0]?.mood ?? "none yet"} />
        <StatTile label="Average intensity" value={avg === null ? "none yet" : `${avg.toFixed(1)} / 5`} hint="1 is mild, 5 is intense" />
        <StatTile label="People to reach out to" value={String(stats?.nudges ?? nudges.length)} />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col gap-5">
          <MoodBars counts={counts} />
          {stats && <UsageCard usage={stats.usage} />}
          <section className="rounded-3xl bg-[var(--card)] p-5">
            <h2 className="mb-3 text-xs uppercase tracking-widest text-[var(--muted)]">What your companions remember</h2>
            {memories.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Things you tell it will be remembered for next time.</p>
            ) : (
              <ul className="space-y-2">
                {memories.map((m) => (
                  <li key={m.id} className="rounded-xl bg-[var(--card-strong)] px-3 py-2 text-sm">
                    {m.fact}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-3xl bg-[var(--card)] p-5">
            <NudgeList nudges={nudges} />
          </section>
        </div>
        <div className="flex flex-col gap-5">
          <CallLog calls={calls} />
          <MoodHistory moods={moods} />
        </div>
      </div>
    </main>
  );
}
