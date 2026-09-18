"use client";

import { useState } from "react";
import type { NudgeEntry } from "@/shared/moods";

/** Bridge agent output: real people to reach out to, with a ready-to-send text. */
export function NudgeList({ nudges }: { nudges: NudgeEntry[] }) {
  const [copied, setCopied] = useState<number | null>(null);

  const copy = async (n: NudgeEntry) => {
    try {
      await navigator.clipboard.writeText(n.message);
      setCopied(n.id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard blocked; the text is still visible to copy by hand
    }
  };

  return (
    <div>
      <h2 className="mb-3 text-xs uppercase tracking-widest text-[var(--muted)]">Reach out for real</h2>
      {nudges.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          When you mention someone you care about, it drafts a text so you can reach out to them.
        </p>
      ) : (
        <ul className="space-y-2">
          {nudges.map((n) => (
            <li key={n.id} className="fade-in rounded-xl border border-[#4a3a2c] bg-[#2a2019] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">Text {n.person}</span>
                <button
                  type="button"
                  onClick={() => void copy(n)}
                  className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-[#2a1a12]"
                >
                  {copied === n.id ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-1 text-sm">&ldquo;{n.message}&rdquo;</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
