let worker: Worker | undefined;
let processing = false;

export async function transcribeRecording(audio: Blob, language: string, signal: AbortSignal, onReady: () => void) {
  const audioContext = new OfflineAudioContext(1, 1, 16_000);
  const decoded = await audioContext.decodeAudioData(await audio.arrayBuffer());
  signal.throwIfAborted();
  const samples = new Float32Array(decoded.length);
  for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
    const input = decoded.getChannelData(channel);
    for (let i = 0; i < input.length; i++) samples[i] += input[i] / decoded.numberOfChannels;
  }
  if (samples.length < 4000 || !samples.some(sample => Math.abs(sample) > 0.001)) return "";
  if (processing) throw new Error("Wait for the current recording to finish transcribing.");
  const active = worker ??= new Worker(new URL("./transcription.worker.ts", import.meta.url), { type: "module" });
  processing = true;

  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => fail(new Error("Speech recognition timed out. Try a shorter recording or type your answer.")), 180_000);
    function cleanup() {
      processing = false;
      clearTimeout(timeout);
      active.removeEventListener("message", onMessage);
      active.removeEventListener("error", onError);
      signal.removeEventListener("abort", onAbort);
    }
    function fail(error: unknown) {
      cleanup();
      active.terminate();
      if (worker === active) worker = undefined;
      reject(error);
    }
    function onError() {
      fail(new Error("Could not load on-device speech recognition. Check your connection and try again, or type your answer."));
    }
    function onAbort() {
      fail(signal.reason);
    }
    function onMessage({ data }: MessageEvent<{ type: string; text?: string }>) {
      if (data.type === "ready") onReady();
      if (data.type === "error") onError();
      if (data.type === "result") {
        cleanup();
        resolve(data.text ?? "");
      }
    }
    active.addEventListener("message", onMessage);
    active.addEventListener("error", onError);
    signal.addEventListener("abort", onAbort, { once: true });
    try {
      active.postMessage({ samples, language }, [samples.buffer]);
    } catch (error) {
      fail(error);
    }
  });
}
