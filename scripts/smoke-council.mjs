// Scenario check for the Bridge agent and Inner Council handoff (no microphone needed).
// Usage: node scripts/smoke-council.mjs [baseUrl]   (dev server must be running)
import { smokeSession } from "./lib/session.mjs";
const base = process.argv[2] ?? "http://localhost:3100";
const cookie = await smokeSession(base);
const post = (path, body) =>
  fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify(body) }).then((r) => r.json());

async function leg(personaId, turns, handoff) {
  const cfg = await post("/api/session", { personaId, voiceId: "ethan", handoff });
  if (cfg.error) throw new Error(cfg.error);
  const ws = new WebSocket(cfg.url, ["realtime", `bai-client-secret.${cfg.clientSecret}`]);
  const send = (e) => ws.send(JSON.stringify(e));
  const transcript = [];
  const tools = [];
  let turn = -1; // -1 = the companion's opening line
  let lastSpoken = "";
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), 60_000);
    const next = () => {
      turn += 1;
      if (turn >= turns.length) {
        clearTimeout(timer);
        ws.close(1000);
        return resolve({ transcript, tools });
      }
      transcript.push({ role: "user", text: turns[turn] });
      post("/api/observe", { text: turns[turn], personaId }).then((r) =>
        console.log(`  listener -> ${r.actions.map((a) => a.name).join(", ") || "none"}`),
      );
      send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: turns[turn] }] } });
      send({ type: "response.create" });
    };
    ws.onopen = () => send({ type: "session.update", session: cfg.session });
    ws.onmessage = async (m) => {
      const ev = JSON.parse(m.data);
      if (ev.type === "session.created") send({ type: "response.create" });
      if (ev.type === "response.output_audio_transcript.done") {
        lastSpoken = ev.transcript;
        transcript.push({ role: "assistant", text: ev.transcript });
        console.log(`  [${personaId}] ${ev.transcript}`);
      }
      if (ev.type === "error") console.log("  error:", ev.error?.message);
      if (ev.type !== "response.done") return;
      const calls = ev.response.output.filter((o) => o.type === "function_call");
      const phrase = /let me bring in your (loving partner|sassy best friend|fairy godmother)[^?]*?[.!]?$/i.exec(lastSpoken);
      if (!calls.some((c) => c.name === "bring_in_persona") && phrase) {
        const persona = phrase[1].toLowerCase().replace(/ /g, "-");
        console.log(`  (spoken-phrase trigger -> ${persona})`);
        clearTimeout(timer);
        ws.close(1000);
        return resolve({ transcript, tools, handoff: { persona, reason: "The conversation called for this self." } });
      }
      for (const c of calls) {
        tools.push({ name: c.name, args: JSON.parse(c.arguments) });
        console.log(`  tool ${c.name} ${c.arguments}`);
        if (c.name === "bring_in_persona") {
          clearTimeout(timer);
          ws.close(1000);
          return resolve({ transcript, tools, handoff: JSON.parse(c.arguments) });
        }
        send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: c.call_id, output: JSON.stringify({ ok: false }) } });
      }
      if (calls.length) send({ type: "response.create" });
      else next();
    };
  });
}

console.log("LEG 1: Loving Partner");
const one = await leg("loving-partner", [
  "Honestly I've been feeling really lonely this week. I miss my sister Maya, we haven't talked in weeks.",
  "You're right. But I also keep putting everything off. I need someone to be real with me. Can I talk to my Sassy Best Friend?",
]);
await new Promise((r) => setTimeout(r, 2500)); // let the Listener finish
if (!one.handoff) {
  console.log("RESULT: no handoff happened");
  process.exit(1);
}

console.log(`\nLEG 2: handoff to ${one.handoff.persona} (${one.handoff.reason})`);
const two = await leg(one.handoff.persona, [], {
  from: "loving-partner",
  reason: one.handoff.reason,
  recent: one.transcript.slice(-8),
});
console.log("\nRESULT:", {
  bridge: (await fetch(`${base}/api/moods`, { headers: { Cookie: cookie } }).then((r) => r.json())).nudges.length > 0,
  handoff: one.handoff.persona,
  newPersonaSpoke: two.transcript.length > 0,
});
const feed = await fetch(`${base}/api/moods`, { headers: { Cookie: cookie } }).then((r) => r.json());
console.log("nudges in DB:", feed.nudges.map((n) => `${n.person}: "${n.message}"`));
