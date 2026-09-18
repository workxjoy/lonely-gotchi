import type { Mood } from "@/shared/moods";

const BODY_COLOR: Record<Mood | "none", string> = {
  none: "#e9dcc8",
  happy: "#ffd166",
  grateful: "#f4a6c1",
  anxious: "#f6c177",
  sad: "#8fb0f5",
  tired: "#b7b0d4",
  lonely: "#a898e0",
  overwhelmed: "#f58ea0",
  calm: "#86d8bf",
  hopeful: "#ffd98a",
  confident: "#ffab7a",
};

const MOUTH: Record<Mood | "none", string> = {
  none: "M84 122 Q100 130 116 122",
  happy: "M78 116 Q100 142 122 116",
  grateful: "M82 119 Q100 134 118 119",
  hopeful: "M80 118 Q100 136 120 118",
  confident: "M78 116 Q100 140 122 116",
  calm: "M84 121 Q100 131 116 121",
  sad: "M82 130 Q100 116 118 130",
  lonely: "M84 128 Q100 120 116 128",
  tired: "M86 125 L114 125",
  anxious: "M80 124 q5 -6 10 0 t10 0 t10 0 t10 0",
  overwhelmed: "M80 124 q5 -8 10 0 t10 0 t10 0 t10 0",
};

interface Props {
  mood: Mood | null;
  speaking: boolean;
  listening: boolean;
}

/** The companion's face: color and expression follow the latest logged mood. */
export function Gotchi({ mood, speaking, listening }: Props) {
  const key = mood ?? "none";
  const sleepy = key === "tired";
  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        viewBox="0 0 200 200"
        className={`h-44 w-44 drop-shadow-xl gotchi-bob ${listening ? "gotchi-listen" : ""}`}
        aria-label={`gotchi feeling ${mood ?? "curious"}`}
      >
        <ellipse cx="100" cy="182" rx="46" ry="8" fill="rgba(0,0,0,0.25)" />
        <path
          d="M100 20 C150 20 172 70 172 112 C172 152 142 176 100 176 C58 176 28 152 28 112 C28 70 50 20 100 20 Z"
          fill={BODY_COLOR[key]}
          style={{ transition: "fill 600ms ease" }}
        />
        <circle cx="62" cy="116" r="9" fill="#ff8fa3" opacity="0.45" />
        <circle cx="138" cy="116" r="9" fill="#ff8fa3" opacity="0.45" />
        {sleepy ? (
          <>
            <path d="M68 96 Q78 102 88 96" stroke="#2a2233" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M112 96 Q122 102 132 96" stroke="#2a2233" strokeWidth="4" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="78" cy="96" r="8" fill="#2a2233" className="gotchi-blink" />
            <circle cx="122" cy="96" r="8" fill="#2a2233" className="gotchi-blink" />
            <circle cx="81" cy="93" r="2.5" fill="#fff" />
            <circle cx="125" cy="93" r="2.5" fill="#fff" />
          </>
        )}
        {speaking ? (
          <ellipse cx="100" cy="124" rx="12" ry="9" fill="#2a2233" className="gotchi-talk" />
        ) : (
          <path d={MOUTH[key]} stroke="#2a2233" strokeWidth="4" fill="none" strokeLinecap="round" />
        )}
      </svg>
      <p className="text-sm text-[var(--muted)]">
        {speaking ? "talking to you" : listening ? "listening" : mood ? `last felt ${mood}` : "waiting for you"}
      </p>
    </div>
  );
}
