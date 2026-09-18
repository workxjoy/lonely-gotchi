import { base64ToFloat32 } from "./pcm";

/** Gapless playback of streamed PCM16 chunks, with instant stop for barge-in. */
export class PcmPlayer {
  private nextStart = 0;
  private sources = new Set<AudioBufferSourceNode>();

  constructor(
    private readonly ctx: AudioContext,
    private readonly onActiveChange: (active: boolean) => void,
  ) {}

  get active(): boolean {
    if (this.sources.size > 0 && this.ctx.currentTime > this.nextStart + 0.25) {
      // onended can be missed (e.g. the context was paused); a stale "speaking" state must not mute the mic.
      this.sources.clear();
      this.onActiveChange(false);
    }
    return this.sources.size > 0;
  }

  enqueue(base64: string): void {
    const samples = base64ToFloat32(base64);
    if (samples.length === 0) return;
    const buffer = this.ctx.createBuffer(1, samples.length, this.ctx.sampleRate);
    buffer.copyToChannel(samples, 0);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.ctx.destination);

    const startAt = Math.max(this.ctx.currentTime + 0.02, this.nextStart);
    source.start(startAt);
    this.nextStart = startAt + buffer.duration;

    this.sources.add(source);
    if (this.sources.size === 1) this.onActiveChange(true);
    source.onended = () => {
      this.sources.delete(source);
      if (this.sources.size === 0) this.onActiveChange(false);
    };
  }

  /** Resolves once queued audio has finished playing (or after `timeoutMs`). */
  whenIdle(timeoutMs = 8000): Promise<void> {
    if (this.sources.size === 0) return Promise.resolve();
    return new Promise((resolve) => {
      const started = Date.now();
      const check = () => {
        if (this.sources.size === 0 || Date.now() - started > timeoutMs) resolve();
        else setTimeout(check, 100);
      };
      check();
    });
  }

  stop(): void {
    for (const source of this.sources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // already stopped
      }
    }
    this.sources.clear();
    this.nextStart = 0;
    this.onActiveChange(false);
  }
}
