import type { Mood } from "@/shared/moods";

/**
 * How often each mood came up. Single series, so one hue and no legend; bars are capped at
 * 20px, grow from one baseline with a rounded data-end, and show a tooltip on hover.
 */
export function MoodBars({ counts }: { counts: { mood: Mood; count: number }[] }) {
  const max = Math.max(1, ...counts.map((c) => c.count));
  return (
    <figure className="rounded-3xl bg-[var(--card)] p-5">
      <figcaption className="mb-4 text-xs uppercase tracking-widest text-[var(--muted)]">How you have felt</figcaption>
      {counts.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Your moods appear here after your first call.</p>
      ) : (
        <ul className="space-y-3" role="list">
          {counts.map(({ mood, count }) => (
            <li key={mood} className="grid grid-cols-[96px_1fr] items-center gap-3">
              <span className="text-sm capitalize text-[var(--muted)]">{mood}</span>
              <div className="group relative flex items-center gap-2">
                <div
                  className="h-5 rounded-r-[4px] bg-[var(--accent)] transition-[filter] group-hover:brightness-110"
                  style={{ width: `${(count / max) * 85}%`, minWidth: 6 }}
                  aria-label={`${mood}: ${count} ${count === 1 ? "time" : "times"}`}
                />
                <span className="text-sm text-[var(--foreground)]">{count}</span>
                <span className="pointer-events-none absolute -top-8 left-0 hidden rounded-lg bg-[#0f0c14] px-2 py-1 text-xs text-[var(--foreground)] shadow-lg group-hover:block">
                  Felt {mood} {count} {count === 1 ? "time" : "times"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
