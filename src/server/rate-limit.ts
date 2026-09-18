import "server-only";

// Fixed-window, in-memory limiter keyed by signed-in user id. Enough to stop one account from
// burning the Boson balance; it resets on restart and is per-instance, fine for a single server.
const windows = new Map<string, { start: number; count: number }>();

export function rateLimited(userId: string, bucket: string, limit: number, windowMs: number): boolean {
  const key = `${bucket}:${userId}`;
  const now = Date.now();
  if (windows.size > 5_000) {
    for (const [k, w] of windows) if (now - w.start > windowMs) windows.delete(k);
  }
  const w = windows.get(key);
  if (!w || now - w.start > windowMs) {
    windows.set(key, { start: now, count: 1 });
    return false;
  }
  w.count += 1;
  return w.count > limit;
}
