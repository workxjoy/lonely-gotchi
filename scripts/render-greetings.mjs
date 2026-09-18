// Renders each persona's Higgs Avatar clips from public/avatars/<persona>.jpg:
//   <persona>.mp4       the lip-synced opening line (plays with sound when a call starts)
//   <persona>-talk.mp4  a generic talking loop (plays muted while the live voice is speaking)
// Usage: node --env-file=.env.local scripts/render-greetings.mjs [persona-id...] [--kind=greeting|talk]
import { readFile, writeFile } from "node:fs/promises";

const API = "https://api.boson.ai/v1/videos";
const key = process.env.BOSON_API_KEY;
if (!key?.startsWith("bai-")) throw new Error("BOSON_API_KEY missing (use --env-file=.env.local)");
const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

// Keep in sync with src/shared/personas.ts
const personas = (await readFile("src/shared/personas.ts", "utf8"))
  .split('id: "')
  .slice(1)
  .map((chunk) => ({
    id: chunk.slice(0, chunk.indexOf('"')),
    voice: /voice: "([^"]+)"/.exec(chunk)[1],
    greeting: /greeting: "([^"]+)"/.exec(chunk)[1],
    greetingHi: /greetingHi: "([^"]+)"/.exec(chunk)?.[1],
    greetingZh: /greetingZh: "([^"]+)"/.exec(chunk)?.[1],
    greetingKo: /greetingKo: "([^"]+)"/.exec(chunk)?.[1],
  }));

// Natural, varied speech so the loop's mouth movement reads as conversation.
const TALK_LINE =
  "Mm, I hear you. And honestly? You are doing so much better than you give yourself credit for. I'm right here with you, okay, every single step of the way.";

async function render({ id, voice: presetVoice, greeting, greetingHi, greetingZh, greetingKo }, kind) {
  // Personal voice clones live in .env.local (VOICE_<PERSONA_ID>), never in the repo.
  const override = process.env[`VOICE_${id.toUpperCase().replace(/-/g, "_")}`];
  const voice = override?.startsWith("voice_") ? override : presetVoice;
  const text = { greeting, "greeting-hi": greetingHi, "greeting-zh": greetingZh, "greeting-ko": greetingKo, talk: TALK_LINE }[kind];
  if (!text) return;
  const face = `data:image/jpeg;base64,${(await readFile(`public/avatars/${id}.jpg`)).toString("base64")}`;
  const created = await fetch(API, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "higgs-avatar",
      ref_image: face,
      input_tts: { model: "higgs-tts-3", input: text, voice },
      size: "480x640",
    }),
  }).then((r) => r.json());
  if (!created.id) throw new Error(`${id}: ${JSON.stringify(created)}`);
  for (;;) {
    await new Promise((r) => setTimeout(r, 2000));
    const v = await fetch(`${API}/${created.id}`, { headers }).then((r) => r.json());
    if (v.status === "completed") break;
    if (v.status === "failed") throw new Error(`${id}: ${JSON.stringify(v.error)}`);
  }
  const mp4 = Buffer.from(await (await fetch(`${API}/${created.id}/content`, { headers })).arrayBuffer());
  const suffix = { greeting: "", "greeting-hi": "-hi", "greeting-zh": "-zh", "greeting-ko": "-ko", talk: "-talk" }[kind];
  const out = `${id}${suffix}.mp4`;
  await writeFile(`public/avatars/${out}`, mp4);
  console.log(`rendered ${out} (${(mp4.length / 1024).toFixed(0)} KB)`);
}

// Optional args: persona ids to render (default: all). Sequential: Boson rate-limits parallel avatar jobs.
const args = process.argv.slice(2);
const kindArg = args.find((a) => a.startsWith("--kind="))?.slice("--kind=".length);
const kinds = kindArg ? [kindArg] : ["greeting", "greeting-hi", "greeting-ko", "talk"];
const only = args.filter((a) => !a.startsWith("--"));
for (const persona of personas.filter((p) => only.length === 0 || only.includes(p.id))) {
  for (const kind of kinds) await render(persona, kind);
}
