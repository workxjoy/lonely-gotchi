"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isSignup = mode === "signup";

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();
    setPending(true);
    setError(null);
    const { error: authError } = isSignup
      ? await authClient.signUp.email({ email, password, name })
      : await authClient.signIn.email({ email, password });
    setPending(false);
    if (authError) {
      setError(authError.message ?? "Something went wrong. Please try again.");
      return;
    }
    router.push("/app");
    router.refresh();
  };

  const input =
    "w-full rounded-xl border border-[#3a3048] bg-[var(--card-strong)] px-4 py-3 text-[15px] outline-none focus:border-[var(--accent)]";

  return (
    <div className="w-full max-w-sm rounded-3xl bg-[var(--card)] p-8 shadow-2xl">
      <h1 className="text-2xl font-bold tracking-tight">{isSignup ? "Create your account" : "Welcome back"}</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {isSignup ? "Your companions will remember you across calls." : "Sign in to call your companions."}
      </p>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
        {isSignup && (
          <label className="grid gap-1 text-sm">
            First name
            <input name="name" required maxLength={40} autoComplete="given-name" className={input} />
          </label>
        )}
        <label className="grid gap-1 text-sm">
          Email
          <input name="email" type="email" required autoComplete="email" className={input} />
        </label>
        <label className="grid gap-1 text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={isSignup ? "new-password" : "current-password"}
            className={input}
          />
        </label>
        {error && <p className="rounded-xl bg-[#3a1d24] px-3 py-2 text-sm text-[#ffb3bd]">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-full bg-[var(--accent)] px-6 py-3 font-semibold text-[#2a1a12] transition hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "One moment..." : isSignup ? "Create account" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-[var(--muted)]">
        {isSignup ? "Already have an account? " : "New here? "}
        <Link href={isSignup ? "/login" : "/signup"} className="font-semibold text-[var(--accent)]">
          {isSignup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
