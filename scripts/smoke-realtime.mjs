// End-to-end protocol check without a microphone: text in, tool calls executed, reply out.
// Usage: node scripts/smoke-realtime.mjs [baseUrl]   (dev server must be running)
import { smokeSession } from "./lib/session.mjs";
const base = process.argv[2] ?? "http://localhost:3100";
const cookie = await smokeSession(base);

const sessionRes = await fetch(`${base}/api/session`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookie },
  body: JSON.stringify({ personaId: process.env.PERSONA ?? "fairy-godmother" }),
});
const body = await sessionRes.json();
if (!sessionRes.ok) {
  console.error("session failed:", body.error);
  process.exit(1);
}
console.log("session ok, key prefix:", body.clientSecret.slice(0, 8));

const ws = new WebSocket(body.url, ["realtime", `bai-client-secret.${body.clientSecret}`]);
const send = (e) => ws.send(JSON.stringify(e));
const counts = {};
let audioBytes = 0;
let replies = 0;
const timer = setTimeout(() => finish("timeout"), 45_000);

function finish(reason) {
  clearTimeout(timer);
  console.log("\nevents:", counts);
  console.log("audio bytes received:", audioBytes);
  console.log("done:", reason);
  ws.close(1000);
  process.exit(reason === "ok" ? 0 : 1);
}

ws.onopen = () => send({ type: "session.update", session: body.session });
ws.onclose = (e) => console.log("closed", e.code, e.reason);
ws.onmessage = async (msg) => {
  const ev = JSON.parse(msg.data);
  counts[ev.type] = (counts[ev.type] ?? 0) + 1;
  switch (ev.type) {
    case "session.created":
      send({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "Honestly I'm pretty anxious. I have a job interview at Stripe on Friday and I keep overthinking it." }],
        },
      });
      send({ type: "response.create" });
      return;
    case "response.output_audio.delta":
      audioBytes += (ev.delta?.length ?? 0) * 0.75;
      return;
    case "response.output_audio_transcript.done":
      console.log("\nassistant:", ev.transcript);
      return;
    case "error":
      console.log("\nerror event:", JSON.stringify(ev.error));
      return;
    case "response.done": {
      replies += 1;
      if (replies === 1) {
        const text = "Mostly the system design round. I would say I am anxious, like four out of five. Also my sister Maya is flying in on Saturday, which helps.";
        const out = await fetch(`${base}/api/observe`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookie },
          body: JSON.stringify({ text, personaId: process.env.PERSONA ?? "fairy-godmother" }),
        }).then((r) => r.json());
        console.log("\nlistener ->", out.actions?.map((a) => a.name).join(", ") || "none");
        send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text }] } });
        send({ type: "response.create" });
        return;
      }
      finish("ok");
      return;
    }
  }
};
