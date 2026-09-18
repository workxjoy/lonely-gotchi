// One command to give a persona a custom Higgs voice from a consented recording.
//   npm run voice:create -- <audio file> [persona-id] ["exact transcript"]
// Steps: convert to 24 kHz mono WAV (macOS afconvert) -> trim to 30 s -> transcribe with Higgs STT
// (unless a transcript is given) -> register via POST /v1/audio/voices -> update src/shared/personas.ts
// -> re-render that persona's avatar greeting clip.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const key = process.env.BOSON_API_KEY;
if (!key?.startsWith("bai-")) throw new Error("BOSON_API_KEY missing (run through npm run voice:create)");
const [file, personaId = "fairy-godmother", givenTranscript] = process.argv.slice(2);
if (!file) throw new Error("Usage: npm run voice:create -- <audio file> [persona-id] [\"exact transcript\"]");

const RATE = 24_000;
const MAX_SECONDS = 30;

// 1. Convert anything CoreAudio reads (m4a, mp3, wav, caf, aac...) to 16-bit mono PCM WAV.
const work = mkdtempSync(path.join(tmpdir(), "voice-"));
const wavPath = path.join(work, "ref.wav");
execFileSync("afconvert", ["-f", "WAVE", "-d", `LEI16@${RATE}`, "-c", "1", file, wavPath]);
const wav = readFileSync(wavPath);
const dataAt = wav.indexOf(Buffer.from("data")) + 8;
let pcm = wav.subarray(dataAt);
const seconds = pcm.length / 2 / RATE;
if (seconds < 3) throw new Error(`Recording is ${seconds.toFixed(1)} s; Boson needs at least 3 s.`);

// 2. Trim to 30 s (Boson recommends 5 to 30 s of clean speech).
pcm = pcm.subarray(0, Math.min(pcm.length, MAX_SECONDS * RATE * 2));
const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write("WAVEfmt ", 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(RATE, 24);
header.writeUInt32LE(RATE * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(pcm.length, 40);
const refWav = Buffer.concat([header, pcm]);
console.log(`audio: ${(pcm.length / 2 / RATE).toFixed(1)} s used of ${seconds.toFixed(1)} s`);

// 3. Transcribe with Higgs STT through a Realtime session (manual commit, no reply generated).
async function transcribe() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket("wss://api.boson.ai/v1/realtime?model=higgs-realtime", {
      headers: { Authorization: `Bearer ${key}` },
    });
    const timer = setTimeout(() => reject(new Error("transcription timed out")), 60_000);
    ws.onopen = async () => {
      const send = (e) => ws.send(JSON.stringify(e));
      send({
        type: "session.update",
        session: {
          model: "higgs-realtime",
          output_modalities: ["text"],
          audio: { input: { format: { type: "audio/pcm", rate: RATE }, turn_detection: null, transcription: { model: "higgs-stt-3.1" } } },
        },
      });
      const chunk = RATE * 2; // 1 s per append
      for (let i = 0; i < pcm.length; i += chunk) send({ type: "input_audio_buffer.append", audio: pcm.subarray(i, i + chunk).toString("base64") });
      send({ type: "input_audio_buffer.commit" });
    };
    ws.onmessage = (m) => {
      const ev = JSON.parse(m.data);
      if (ev.type === "conversation.item.input_audio_transcription.completed") {
        clearTimeout(timer);
        ws.close(1000);
        resolve((ev.transcript ?? "").trim());
      }
      if (ev.type === "error") {
        clearTimeout(timer);
        reject(new Error(ev.error?.message ?? "STT error"));
      }
    };
  });
}
const refText = givenTranscript ?? (await transcribe());
if (!refText) throw new Error("Empty transcript; pass the exact words as the third argument.");
console.log(`transcript: "${refText}"`);

// 4. Register the voice.
const res = await fetch("https://api.boson.ai/v1/audio/voices", {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    ref_audio: `data:audio/wav;base64,${refWav.toString("base64")}`,
    ref_text: refText,
    description: `lonely-gotchi ${personaId}`,
  }),
});
const body = await res.json();
if (!res.ok) throw new Error(`create voice failed ${res.status}: ${JSON.stringify(body)}`);
// The API returns `voice_id` (the docs show `voice`); accept both.
const voiceId = body.voice_id ?? body.voice;
console.log(`custom voice: ${voiceId}`);

// 5. Point the persona at it via .env.local (gitignored), so the clone ID never lands in the repo.
const envKey = `VOICE_${personaId.toUpperCase().replace(/-/g, "_")}`;
const envPath = ".env.local";
let envText = "";
try {
  envText = readFileSync(envPath, "utf8");
} catch {
  // first run: no .env.local yet
}
const line = `${envKey}=${voiceId}`;
envText = new RegExp(`^${envKey}=.*$`, "m").test(envText)
  ? envText.replace(new RegExp(`^${envKey}=.*$`, "m"), line)
  : `${envText.replace(/\n?$/, "\n")}${line}\n`;
writeFileSync(envPath, envText);
process.env[envKey] = voiceId;
console.log(`${personaId} now speaks with ${voiceId} (${envKey} in .env.local; restart the dev server)`);

// 6. Re-render that persona's greeting clip with the new voice.
execFileSync("node", ["scripts/render-greetings.mjs", personaId], { stdio: "inherit", env: process.env }); // greeting + talk loop
