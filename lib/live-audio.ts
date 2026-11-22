export function captureSpokenTurns(
  stream: MediaStream,
  audio: AudioContext,
  onTurn: (clip: Blob, completedAt: number) => void,
  onError: () => void,
) {
  const analyser = audio.createAnalyser();
  analyser.fftSize = 1024;
  const source = audio.createMediaStreamSource(stream);
  source.connect(analyser);
  const buffer = new Float32Array(analyser.fftSize);
  let recorder: MediaRecorder | undefined;
  let pending = Promise.resolve();
  let deliver = false;
  let closed = false;
  let paused = false;
  let voicedAt = 0;
  let capturedAt = 0;

  function begin() {
    if (closed || paused || recorder) return;
    const clip = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    clip.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    clip.onerror = onError;
    clip.start();
    recorder = clip;
    capturedAt = performance.now();
    voicedAt = 0;
    pending = new Promise(resolve => {
      clip.onstop = () => {
        resolve();
        if (deliver && chunks.length) onTurn(new Blob(chunks, { type: clip.mimeType }), performance.now());
      };
    });
  }

  async function flush(force = false) {
    const current = recorder;
    if (current?.state === "recording") {
      deliver = force || voicedAt > 0;
      current.stop();
    }
    await pending;
    if (recorder === current) recorder = undefined;
  }

  async function advance(force = false) {
    if (recorder?.state !== "recording") return;
    await flush(force);
    begin();
  }

  begin();
  const interval = setInterval(() => {
    if (recorder?.state !== "recording") return;
    analyser.getFloatTimeDomainData(buffer);
    const rms = Math.sqrt(buffer.reduce((sum, sample) => sum + sample * sample, 0) / buffer.length);
    const now = performance.now();
    if (rms > 0.012) voicedAt = now;
    if ((voicedAt && now - voicedAt > 850) || now - capturedAt >= 15_000) {
      void advance().catch(onError);
    }
  }, 100);
  return {
    finishTurn: () => advance(true),
    pause() {
      paused = true;
      return flush();
    },
    async resume() {
      paused = false;
      await pending;
      begin();
    },
    async finish() {
      closed = true;
      clearInterval(interval);
      source.disconnect();
      await flush();
    },
  };
}
