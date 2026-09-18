// Learning-loop check: call log -> summarizer -> next call's prompt remembers it.
// Usage: node scripts/smoke-learning.mjs [baseUrl]   (dev server must be running)
import { smokeSession } from "./lib/session.mjs";

const base = process.argv[2] ?? "http://localhost:3100";
const cookie = await smokeSession(base);
const post = (path, body) =>
  fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json() }));

const first = await post("/api/session", { personaId: "loving-partner" });
console.log("call started, id:", first.body.callId);

const lines = [
  { role: "assistant", text: "Hey you. I'm so glad you picked up. How are you really doing tonight?" },
  { role: "user", text: "Honestly good. I finally finished my pottery class project, a blue mug for my dad." },
  { role: "assistant", text: "My love, that's wonderful. How did it feel to finish it?" },
  { role: "user", text: "Really proud. Talking it through with you and hearing you be excited for me helped a lot." },
];
const ended = await post(`/api/calls/${first.body.callId}/end`, { lines, usage: { input_tokens: 1200, output_tokens: 300, cached_tokens: 200 } });
console.log("call ended + summarized:", ended.status, ended.body);

const mood = await post("/api/observe", { text: "I feel good today, honestly.", personaId: "loving-partner" });
console.log("listener on 'I feel good today':", mood.body.actions.map((a) => `${a.name}${a.args?.mood ? `(${a.args.mood})` : ""}`).join(", ") || "none");

const next = await post("/api/session", { personaId: "sassy-best-friend" });
const prompt = next.body.session.instructions;
const section = prompt.slice(prompt.indexOf("Your last calls"), prompt.indexOf("Your last calls") + 600);
console.log("\nnext call's prompt includes:\n" + (prompt.includes("Your last calls") ? section : "NO CALL MEMORY"));
