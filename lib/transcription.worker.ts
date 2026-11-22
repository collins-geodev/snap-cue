import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

env.allowLocalModels = false;
if (env.backends.onnx.wasm) env.backends.onnx.wasm.numThreads = 1;

let model: Promise<AutomaticSpeechRecognitionPipeline> | undefined;

self.onmessage = async ({ data }: MessageEvent<{ samples: Float32Array; language: string }>) => {
  try {
    model ??= pipeline("automatic-speech-recognition", "Xenova/whisper-tiny", {
      device: "wasm", dtype: "q8", revision: "5332fcc35e32a33b86612b9a57a89be7906102b1",
    })
      .catch(error => {
        model = undefined;
        throw error;
      });
    const transcribe = await model;
    self.postMessage({ type: "ready" });
    const result = await transcribe(data.samples, {
      language: data.language, task: "transcribe", chunk_length_s: 25, stride_length_s: 4,
    });
    const text = (Array.isArray(result) ? result.map(segment => segment.text).join(" ") : result.text).trim();
    self.postMessage({ type: "result", text });
  } catch {
    self.postMessage({ type: "error" });
  }
};
