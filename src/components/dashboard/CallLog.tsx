import type { CallEntry } from "@/shared/moods";
import { getPersona } from "@/shared/personas";

function duration(c: CallEntry) {
  if (!c.endedAt) return "";
  const sec = Math.max(1, Math.round((new Date(c.endedAt).getTime() - new Date(c.startedAt).getTime()) / 1000));
  return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

/** Call logs with the summarizer agent's notes and the full transcript. */
export function CallLog({ calls }: { calls: CallEntry[] }) {
  return (
    <section className="rounded-3xl bg-[var(--card)] p-5">
      <h2 className="mb-4 text-xs uppercase tracking-widest text-[var(--muted)]">Recent calls</h2>
      {calls.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Your calls, with summaries and transcripts, appear here after you hang up.</p>
      ) : (
        <ul className="space-y-3">
          {calls.map((c) => (
            <li key={c.id} className="rounded-2xl bg-[var(--card-strong)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{getPersona(c.persona)?.name ?? c.persona}</span>
                <span className="text-xs text-[var(--muted)]">
                  {new Date(c.startedAt).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}
                  {duration(c) && ` · ${duration(c)}`}
                </span>
              </div>
              <p className="mt-2 text-sm">{c.summary ?? "Summary is being written..."}</p>
              {c.whatHelped && (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  <span className="font-semibold text-[var(--accent)]">What helped: </span>
                  {c.whatHelped}
                </p>
              )}
              {c.lines.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-[var(--muted)]">
                    Transcript ({c.lines.length} lines)
                  </summary>
                  <ul className="mt-2 space-y-1 text-sm">
                    {c.lines.map((l, i) => (
                      <li key={i} className={l.role === "system" ? "text-center text-xs text-[var(--accent)]" : ""}>
                        {l.role !== "system" && (
                          <span className="font-semibold text-[var(--muted)]">{l.role === "user" ? "You" : "Companion"}: </span>
                        )}
                        {l.text}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
