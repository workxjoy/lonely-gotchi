import type { MoodEntry } from "@/shared/moods";
import { getPersona } from "@/shared/personas";

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

/** Every logged check-in, grouped by day, newest first. */
export function MoodHistory({ moods }: { moods: MoodEntry[] }) {
  const days = new Map<string, MoodEntry[]>();
  for (const m of moods) {
    const key = dayLabel(m.createdAt);
    days.set(key, [...(days.get(key) ?? []), m]);
  }
  return (
    <section className="rounded-3xl bg-[var(--card)] p-5">
      <h2 className="mb-4 text-xs uppercase tracking-widest text-[var(--muted)]">Check-in history</h2>
      {moods.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Nothing yet. Call your companion and tell it how you feel.</p>
      ) : (
        <div className="space-y-5">
          {[...days.entries()].map(([day, entries]) => (
            <div key={day}>
              <h3 className="mb-2 text-sm font-semibold">{day}</h3>
              <ul className="space-y-2">
                {entries.map((m) => (
                  <li key={m.id} className="grid grid-cols-[72px_1fr] gap-3 rounded-xl bg-[var(--card-strong)] px-3 py-2">
                    <span className="text-xs text-[var(--muted)]">
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold capitalize">{m.mood}</span>
                        <span className="text-xs text-[var(--muted)]">intensity {m.intensity}/5</span>
                        <span className="text-xs text-[var(--muted)]">with {getPersona(m.persona)?.name ?? m.persona}</span>
                      </div>
                      {m.note && <p className="mt-1 text-sm text-[var(--muted)]">{m.note}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
