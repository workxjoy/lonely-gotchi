"use client";

import { useEffect, useRef, useState } from "react";
import { AvatarStage } from "@/components/AvatarStage";
import { CallPanel } from "@/components/CallPanel";
import { Gotchi } from "@/components/Gotchi";
import { LanguagePicker } from "@/components/LanguagePicker";
import { PersonaPicker } from "@/components/PersonaPicker";
import { useRealtimeCall } from "@/features/call/useRealtimeCall";
import { useMoodFeed } from "@/features/timeline/useMoodFeed";
import type { LanguageMode } from "@/shared/languages";
import { getPersona, type PersonaId } from "@/shared/personas";

export function CompanionApp({ userName }: { userName: string }) {
  const [personaId, setPersonaId] = useState<PersonaId>("loving-partner");
  const [clipSrc, setClipSrc] = useState<string | null>(null);
  const [language, setLanguage] = useState<LanguageMode>("auto");
  const refreshFeed = useRef<() => void>(() => undefined);
  const call = useRealtimeCall({
    onToolExecuted: () => refreshFeed.current(),
    onPersonaChange: setPersonaId,
  });
  const inCall = call.status === "connecting" || call.status === "live";
  const feed = useMoodFeed(inCall);
  useEffect(() => {
    refreshFeed.current = () => void feed.refresh();
  }, [feed]);

  const latestMood = feed.moods[0]?.mood ?? null;

  const startCall = () => {
    const persona = getPersona(personaId);
    const greeting = language === "hi" ? persona?.greetingHi : language === "zh" ? persona?.greetingZh : persona?.greeting;
    setClipSrc(`/avatars/${personaId}${language === "hi" || language === "zh" ? `-${language}` : ""}.mp4`);
    void call.start(personaId, userName, greeting, language);
  };
  const endClip = () => {
    setClipSrc(null);
    call.greetingFinished();
  };
  const hangUp = () => {
    endClip();
    call.hangUp();
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6 md:px-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{userName ? `Hi ${userName}` : "Call"}</h1>
        <p className="text-sm text-[var(--muted)]">Pick who picks up, press Call, and just talk.</p>
      </header>

      <div className="grid gap-5 md:grid-cols-[320px_1fr]">
        <aside className="flex flex-col items-center gap-5 rounded-3xl bg-[var(--card)] p-5">
          <Gotchi mood={latestMood} speaking={false} listening={false} />
          <PersonaPicker selected={personaId} disabled={inCall} onSelect={setPersonaId} />
          <LanguagePicker value={language} disabled={inCall} onChange={setLanguage} />
        </aside>
        <CallPanel
          status={call.status}
          error={call.error}
          lines={call.lines}
          personaName={getPersona(personaId)?.name ?? ""}
          onCall={startCall}
          onHangUp={hangUp}
          aiSpeaking={call.aiSpeaking}
          userSpeaking={call.userSpeaking}
          thinking={call.thinking}
          onSend={call.sendText}
          avatar={
            <AvatarStage
              faceSrc={`/avatars/${personaId}.jpg`}
              talkSrc={`/avatars/${personaId}-talk.mp4`}
              clipSrc={clipSrc}
              speaking={call.aiSpeaking}
              listening={call.userSpeaking}
              live={inCall}
              onClipEnd={endClip}
            />
          }
        />
      </div>

    </main>
  );
}
