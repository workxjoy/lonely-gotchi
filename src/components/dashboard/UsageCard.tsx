import { estimateCost, type Usage } from "@/shared/pricing";

const fmt = (n: number) => (n >= 10_000 ? `${(n / 1000).toFixed(1)}K` : n.toLocaleString());

/** Boson usage for this account: exact Realtime tokens from each reply, priced with Boson's public rates. */
export function UsageCard({ usage }: { usage: Usage }) {
  const cost = estimateCost(usage);
  const rows = [
    { label: "Input tokens", value: fmt(usage.inputTokens) },
    { label: "Output tokens", value: fmt(usage.outputTokens) },
    { label: "Cached tokens", value: fmt(usage.cachedTokens) },
    { label: "Call minutes", value: (usage.callSeconds / 60).toFixed(1) },
  ];
  return (
    <section className="rounded-3xl bg-[var(--card)] p-5">
      <h2 className="mb-3 text-xs uppercase tracking-widest text-[var(--muted)]">Boson usage</h2>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold">${cost < 0.01 && cost > 0 ? cost.toFixed(4) : cost.toFixed(2)}</span>
        <span className="text-sm text-[var(--muted)]">estimated spend on your calls</span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="rounded-xl bg-[var(--card-strong)] px-3 py-2">
            <dt className="text-xs text-[var(--muted)]">{r.label}</dt>
            <dd className="font-semibold">{r.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-[var(--muted)]">
        Exact token counts reported by Higgs Realtime on every reply, priced at Boson&apos;s published rates (plus speech-to-text
        per call minute). Live balance:{" "}
        <a className="underline" href="https://www.boson.ai/workspace/billing/usage" target="_blank" rel="noreferrer">
          Boson workspace
        </a>
        .
      </p>
    </section>
  );
}
