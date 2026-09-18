import Link from "next/link";
import { Gotchi } from "@/components/Gotchi";

const STATS = [
  { value: "1 in 6", label: "people worldwide are affected by loneliness" },
  { value: "871,000", label: "deaths a year are linked to loneliness" },
  { value: "4 agents", label: "work together on every call" },
];

const FEATURES = [
  {
    title: "Talks like a person",
    body: "A live voice call, not a chatbot. Interrupt it mid-sentence and it stops, listens, and follows you.",
  },
  {
    title: "Remembers you",
    body: "A silent Listener agent notes your mood and the things you share, so the next call picks up where you left off.",
  },
  {
    title: "Your Inner Council",
    body: "Three companions on one line: a Loving Partner, a Sassy Best Friend and a Fairy Godmother with her own custom voice. They hand the call to each other when you need a different kind of support.",
  },
  {
    title: "Hands you back to real people",
    body: "Mention someone you miss and the Bridge agent drafts a text to them. Built to reduce loneliness, not replace your people.",
  },
];

const STEPS = [
  { n: "1", title: "Pick who picks up", body: "Comfort, honesty, or a little magic: choose your companion." },
  { n: "2", title: "Just talk", body: "Say how your day really went. Your mood lands on your timeline on its own." },
  { n: "3", title: "Reach out", body: "Leave the call with a drafted text to someone who matters." },
];

const FAQ = [
  {
    q: "Is this therapy?",
    a: "No. lonely-gotchi is a companion, not a clinician. If you are in crisis in the US, call or text 988, or contact local emergency services.",
  },
  {
    q: "What languages does it speak?",
    a: "Whatever you speak, including switching languages mid-sentence. It follows your lead.",
  },
  {
    q: "What makes it different from other AI companions?",
    a: "Most companions optimize for keeping you talking to them. lonely-gotchi remembers you and actively nudges you toward the real people in your life.",
  },
  {
    q: "What powers it?",
    a: "Boson AI's Higgs Realtime for speech-to-speech voice with interruptions and tool calls, and InstaCloud for the database and hosting.",
  },
];

export default function Landing() {
  return (
    <div className="flex flex-1 flex-col">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 md:px-8">
        <span className="text-lg font-bold tracking-tight">lonely-gotchi</span>
        <div className="flex items-center gap-6 text-sm text-[var(--muted)]">
          <a href="#how" className="hidden hover:text-[var(--foreground)] sm:inline">
            How it works
          </a>
          <a href="#faq" className="hidden hover:text-[var(--foreground)] sm:inline">
            FAQ
          </a>
          <Link href="/login" className="hover:text-[var(--foreground)]">
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full border border-[var(--accent)] px-4 py-2 font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-[#2a1a12]"
          >
            Get started
          </Link>
        </div>
      </nav>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-24 px-4 pb-20 md:px-8">
        <section className="grid items-center gap-12 pt-8 md:grid-cols-[1.2fr_1fr] md:pt-16">
          <div className="flex flex-col gap-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-[var(--accent)]">
              A voice companion for the quiet hours
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              A friend that calls you, listens, and remembers.
            </h1>
            <p className="max-w-xl text-lg text-[var(--muted)]">
              Talk out loud with the version of you that you need tonight. lonely-gotchi keeps track of how you feel
              and gently hands you back to the people who matter.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="rounded-full bg-[var(--accent)] px-6 py-3 font-semibold text-[#2a1a12] transition hover:brightness-110"
              >
                Get started free
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-[#3a3048] px-6 py-3 font-semibold transition hover:border-[var(--accent)]"
              >
                Log in
              </Link>
            </div>
            <p className="text-xs text-[var(--muted)]">Free to try. Use headphones for the best call.</p>
          </div>

          <div className="relative flex flex-col items-center gap-4 rounded-[2rem] bg-[var(--card)] p-8">
            <Gotchi mood="hopeful" speaking={false} listening={false} />
            <div className="w-full space-y-2 text-[15px]">
              <div className="w-fit max-w-[85%] rounded-2xl bg-[var(--card-strong)] px-4 py-2">
                Hey, you picked up. How are you really doing?
              </div>
              <div className="ml-auto w-fit max-w-[85%] rounded-2xl bg-[var(--user-bubble)] px-4 py-2">
                Honestly, kind of lonely. I miss my sister.
              </div>
              <div className="w-fit max-w-[85%] rounded-2xl bg-[var(--card-strong)] px-4 py-2">
                I hear you. I put a little text for her on your screen.
              </div>
              <div className="mx-auto w-fit rounded-full bg-[#3b2a1f] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                Text Maya: drafted
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {STATS.map((s) => (
            <div key={s.value} className="rounded-3xl bg-[var(--card)] p-6">
              <div className="text-4xl font-bold text-[var(--accent)]">{s.value}</div>
              <p className="mt-2 text-[var(--muted)]">{s.label}</p>
            </div>
          ))}
          <p className="text-xs text-[var(--muted)] md:col-span-3">
            Source:{" "}
            <a
              className="underline"
              href="https://www.who.int/news/item/30-06-2025-social-connection-linked-to-improved-heath-and-reduced-risk-of-early-death"
            >
              WHO Commission on Social Connection, June 2025
            </a>
          </p>
        </section>

        <section className="flex flex-col gap-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Not another quote bot</h2>
            <p className="mt-3 text-[var(--muted)]">
              Affirmation apps send generic quotes. They don&apos;t listen, don&apos;t remember, and don&apos;t talk
              back. lonely-gotchi does all three.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-3xl bg-[var(--card)] p-6">
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-[var(--muted)]">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="flex flex-col gap-8">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">How it works</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-3xl border border-[#3a3048] p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] font-bold text-[#2a1a12]">
                  {s.n}
                </div>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-[var(--muted)]">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="flex flex-col gap-6">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Questions</h2>
          <div className="grid gap-3">
            {FAQ.map((item) => (
              <details key={item.q} className="group rounded-2xl bg-[var(--card)] px-6 py-4">
                <summary className="cursor-pointer list-none font-semibold">{item.q}</summary>
                <p className="mt-2 text-[var(--muted)]">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="flex flex-col items-center gap-6 rounded-[2rem] bg-[var(--card)] px-6 py-14 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Someone should check on you tonight.</h2>
          <Link
            href="/signup"
            className="rounded-full bg-[var(--accent)] px-6 py-3 font-semibold text-[#2a1a12] transition hover:brightness-110"
          >
            Create your account
          </Link>
        </section>
      </main>

      <footer className="border-t border-[#2a2236] py-6 text-center text-xs text-[var(--muted)]">
        Built at Build an AI Startup in One Day with Boson AI Higgs Realtime and InstaCloud.
      </footer>
    </div>
  );
}
