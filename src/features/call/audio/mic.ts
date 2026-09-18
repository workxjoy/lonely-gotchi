/** Streams the microphone as PCM16 chunks at the AudioContext's sample rate. */
export async function startMic(
  ctx: AudioContext,
  onChunk: (pcm16: ArrayBuffer) => void,
): Promise<() => void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  let source: MediaStreamAudioSourceNode;
  let recorder: AudioWorkletNode;
  try {
    await ctx.audioWorklet.addModule("/worklets/pcm-recorder.js");
    source = ctx.createMediaStreamSource(stream);
    recorder = new AudioWorkletNode(ctx, "pcm-recorder");
  } catch (err) {
    stream.getTracks().forEach((t) => t.stop()); // don't leave the mic on if audio setup fails
    throw err;
  }
  // Diagnostics (forwarded to the dev server log): which mic Chrome picked and at what rate.
  const settings = stream.getAudioTracks()[0]?.getSettings();
  console.warn("[mic] started", {
    device: stream.getAudioTracks()[0]?.label,
    trackRate: settings?.sampleRate,
    contextRate: ctx.sampleRate,
    echoCancellation: settings?.echoCancellation,
    noiseSuppression: settings?.noiseSuppression,
    autoGainControl: settings?.autoGainControl,
  });
  recorder.port.onmessage = (e: MessageEvent<ArrayBuffer>) => onChunk(e.data);
  source.connect(recorder);

  return () => {
    recorder.port.onmessage = null;
    source.disconnect();
    recorder.disconnect();
    stream.getTracks().forEach((t) => t.stop());
  };
}
