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

// Per-persona memory: the Loving Partner remembers this call, the Sassy Best Friend does not.
const same = (await post("/api/session", { personaId: "loving-partner" })).body.session.instructions;
const other = (await post("/api/session", { personaId: "sassy-best-friend" })).body.session.instructions;
const knows = (prompt) => /pottery|blue mug/i.test(prompt);
console.log("\nLoving Partner remembers the pottery call:", knows(same));
console.log("Sassy Best Friend knows about it (should be false):", knows(other));
const section = same.slice(same.indexOf("Your last calls"), same.indexOf("Your last calls") + 400);
console.log("\nLoving Partner's memory section:\n" + (same.includes("Your last calls") ? section : "NO CALL MEMORY"));
