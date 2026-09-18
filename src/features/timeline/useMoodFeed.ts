"use client";

import { useCallback, useEffect, useState } from "react";
import type { MemoryEntry, MoodEntry, NudgeEntry } from "@/shared/moods";

interface Feed {
  moods: MoodEntry[];
  memories: MemoryEntry[];
  nudges: NudgeEntry[];
}

/** Loads moods + memories, and polls while `live` is true so tool calls show up without a refresh. */
export function useMoodFeed(live: boolean) {
  const [feed, setFeed] = useState<Feed>({ moods: [], memories: [], nudges: [] });

  const refresh = useCallback(
    () =>
      fetch("/api/moods", { cache: "no-store" })
        .then((res) => (res.ok ? (res.json() as Promise<Feed>) : null))
        .then((body) => {
          if (body) setFeed(body);
        })
        .catch(() => undefined), // offline or DB asleep; keep the last good state
    [],
  );

  useEffect(() => {
    refresh();
    if (!live) return;
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [live, refresh]);

  return { ...feed, refresh };
}
