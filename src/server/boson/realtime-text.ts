import "server-only";
import { requireBosonKey } from "@/server/env";
import { REALTIME_URL } from "./client";

export interface FunctionCall {
  name: string;
  arguments: string;
}

// Node's built-in WebSocket (undici) accepts headers; the DOM typings don't know that.
type ServerWebSocket = new (url: string, init: { headers: Record<string, string> }) => WebSocket;

/**
 * One-shot, text-only Higgs Realtime turn run on the server: send one message, collect the tool calls.
 * Used by background agents that never speak.
 */
export function runTextTurn(opts: {
  instructions: string;
  tools: readonly unknown[];
  message: string;
  timeoutMs?: number;
}): Promise<FunctionCall[]> {
  return new Promise((resolve, reject) => {
    const ws = new (WebSocket as unknown as ServerWebSocket)(REALTIME_URL, {
      headers: { Authorization: `Bearer ${requireBosonKey()}` },
    });
    let settled = false;
    const finish = (err: Error | null, calls: FunctionCall[] = []) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (ws.readyState <= WebSocket.OPEN) ws.close(1000);
      if (err) reject(err);
      else resolve(calls);
    };
    const timer = setTimeout(() => finish(new Error("Listener timed out")), opts.timeoutMs ?? 15_000);

    ws.onopen = () => {
      const send = (e: unknown) => ws.send(JSON.stringify(e));
      send({
        type: "session.update",
        session: {
          model: "higgs-realtime",
          output_modalities: ["text"],
          instructions: opts.instructions,
          tools: opts.tools,
          tool_choice: "auto",
          audio: { input: { turn_detection: null } },
        },
      });
      send({
        type: "conversation.item.create",
        item: { type: "message", role: "user", content: [{ type: "input_text", text: opts.message }] },
      });
      send({ type: "response.create" });
    };
    ws.onmessage = (msg) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(msg.data));
      } catch {
        return; // ignore non-JSON frames
      }
      const ev = parsed as {
        type: string;
        error?: { message?: string };
        response?: { output?: Array<{ type: string; name?: string; arguments?: string }> };
      };
      if (ev.type === "error") finish(new Error(ev.error?.message ?? "Realtime error"));
      if (ev.type === "response.done") {
        const calls = (ev.response?.output ?? [])
          .filter((o) => o.type === "function_call" && o.name)
          .map((o) => ({ name: o.name!, arguments: o.arguments ?? "{}" }));
        finish(null, calls);
      }
    };
    ws.onerror = () => finish(new Error("Listener connection failed"));
    ws.onclose = (e) => finish(new Error(`Listener connection closed (code ${e.code})`));
  });
}
