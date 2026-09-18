"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { authClient } from "@/lib/auth-client";

const NAV = [
  { href: "/app", label: "Call", hint: "Talk to a companion" },
  { href: "/app/dashboard", label: "Dashboard", hint: "Moods, memories, people" },
];

interface Props {
  user: { name: string; email: string };
  children: ReactNode;
}

/** Signed-in layout: sidebar navigation + account footer, content on the right. */
export function AppShell({ user, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const signOut = async () => {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 border-b border-[#2a2236] bg-[#120e18] p-4 md:sticky md:top-0 md:h-screen md:w-64 md:border-r md:border-b-0">
        <Link href="/app" className="px-2 text-lg font-bold tracking-tight">
          lonely-gotchi
        </Link>
        <nav className="flex gap-1 md:flex-col">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-xl px-3 py-2 transition ${
                  active ? "bg-[var(--card-strong)] text-[var(--foreground)]" : "text-[var(--muted)] hover:bg-[var(--card)]"
                }`}
              >
                <div className="text-sm font-semibold">{item.label}</div>
                <div className="hidden text-xs text-[var(--muted)] md:block">{item.hint}</div>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto hidden rounded-2xl bg-[var(--card)] p-3 md:block">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] font-bold text-[#2a1a12]">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{user.name}</div>
              <div className="truncate text-xs text-[var(--muted)]">{user.email}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-3 w-full rounded-full border border-[#3a3048] px-3 py-1.5 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
          >
            Sign out
          </button>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="text-left text-sm text-[var(--muted)] md:hidden"
        >
          Sign out ({user.name})
        </button>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
