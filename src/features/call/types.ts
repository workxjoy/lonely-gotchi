export type CallStatus = "idle" | "connecting" | "live" | "ended" | "error";

export interface CaptionLine {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  final: boolean;
  interrupted?: boolean;
}

export interface SessionResponse {
  url: string;
  clientSecret: string;
  session: Record<string, unknown>;
}

/** Subset of Higgs Realtime server events this app reacts to. */
export interface ServerEvent {
  type: string;
  item_id?: string;
  delta?: string;
  transcript?: string;
  item?: { id?: string; role?: string; type?: string };
  error?: { message?: string; type?: string };
  response?: {
    output?: Array<{ type: string; call_id?: string; name?: string; arguments?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number; input_token_details?: { cached_tokens?: number } };
  };
}
