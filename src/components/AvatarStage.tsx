"use client";

import { useEffect, useRef } from "react";

/* eslint-disable @next/next/no-img-element -- static portrait from /public, no optimization needed */

// Personal faces are kept out of git; a fresh clone falls back to the shared sample face.
const FALLBACK_FACE = "/avatars/default-face.jpg";

interface Props {
  /** Portrait for the current persona (public/avatars/<persona>.jpg). */
  faceSrc: string;
  /** Muted talking loop played while the live voice is speaking. */
  talkSrc: string;
  /** Pre-rendered greeting clip to play, or null to show the live portrait. */
  clipSrc: string | null;
  speaking: boolean;
  listening: boolean;
  live: boolean;
  onClipEnd: () => void;
}

/** Video-call style face: a lip-synced Higgs Avatar greeting, then a live portrait that glows while it talks. */
export function AvatarStage({ faceSrc, talkSrc, clipSrc, speaking, listening, live, onClipEnd }: Props) {
  const talk = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = talk.current;
    if (!video) return;
    if (speaking) void video.play().catch(() => undefined);
    else video.pause(); // freezes the instant they interrupt
  }, [speaking]);

  const ring = speaking
    ? "ring-4 ring-[var(--accent)] shadow-[0_0_40px_#ffb38a66]"
    : listening
      ? "ring-4 ring-[#7dd3a8]"
      : "ring-1 ring-[#3a3048]";
  return (
    <div className={`relative aspect-[3/4] w-full max-w-[220px] overflow-hidden rounded-3xl transition-all duration-300 ${ring}`}>
      {clipSrc ? (
        <video
          key={clipSrc}
          src={clipSrc}
          autoPlay
          playsInline
          onEnded={onClipEnd}
          onError={onClipEnd}
          className="h-full w-full object-cover"
        />
      ) : (
        <img
          key={faceSrc}
          src={faceSrc}
          onError={(e) => {
            if (!e.currentTarget.src.endsWith(FALLBACK_FACE)) e.currentTarget.src = FALLBACK_FACE;
          }}
          alt="Your companion"
          className={`h-full w-full object-cover ${live ? "" : "opacity-70"}`}
        />
      )}
      {!clipSrc && (
        <video
          ref={talk}
          key={talkSrc}
          src={talkSrc}
          muted
          loop
          playsInline
          preload="auto"
          onError={(e) => (e.currentTarget.style.display = "none")}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-150 ${speaking ? "opacity-100" : "opacity-0"}`}
        />
      )}
      <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white/80">
        AI avatar
      </span>
    </div>
  );
}
