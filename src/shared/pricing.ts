// Boson published prices (docs.boson.ai/pricing), USD. Realtime is token-billed.
export const PRICE = {
  inputPerToken: 0.75 / 1_000_000,
  cachedInputPerToken: 0.25 / 1_000_000,
  outputPerToken: 4.5 / 1_000_000,
  transcriptionPerMinute: 0.0025,
};

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  callSeconds: number;
}

/** Estimated spend: exact tokens x token prices, plus STT billed per minute of call audio. */
export function estimateCost(u: Usage): number {
  const uncached = Math.max(0, u.inputTokens - u.cachedTokens);
  return (
    uncached * PRICE.inputPerToken +
    u.cachedTokens * PRICE.cachedInputPerToken +
    u.outputTokens * PRICE.outputPerToken +
    (u.callSeconds / 60) * PRICE.transcriptionPerMinute
  );
}
