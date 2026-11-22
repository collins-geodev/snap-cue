export const geminiTextModel = "gemini-3.5-flash-lite";
export const geminiEmbeddingModel = "gemini-embedding-001";

export function geminiProcessesPrivateData() {
  return Boolean(process.env.GEMINI_API_KEY) && process.env.GEMINI_PAID_DATA_PROCESSING === "true";
}

export async function geminiRequest(method: string, body: unknown, signal?: AbortSignal) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("The AI service is unavailable.");
  const timeout = AbortSignal.timeout(45_000);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${method}`, {
    method: "POST", cache: "no-store",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) throw new Error("The AI service could not complete the request.");
  return response;
}

export function geminiPrompt(instructions: string, input: unknown, json = false) {
  return {
    systemInstruction: { parts: [{ text: instructions }] },
    contents: [{ parts: [{ text: JSON.stringify(input) }] }],
    generationConfig: { maxOutputTokens: 3000, ...(json && { responseMimeType: "application/json" }) },
  };
}

export function geminiText(data: { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] }) {
  return data.candidates?.[0]?.content?.parts?.filter(part => !part.thought).map(part => part.text ?? "").join("") ?? "";
}

export async function completeWithGemini(instructions: string, input: unknown, json: boolean) {
  const response = await geminiRequest(`${geminiTextModel}:generateContent`, geminiPrompt(instructions, input, json));
  const result = geminiText(await response.json());
  if (!result) throw new Error("The AI service returned no answer.");
  return result;
}

export async function embedWithGemini(input: string[], query: boolean) {
  const model = `models/${geminiEmbeddingModel}`;
  const response = await geminiRequest(`${geminiEmbeddingModel}:batchEmbedContents`, {
    requests: input.map(text => ({
      model, content: { parts: [{ text }] }, outputDimensionality: 1536,
      taskType: query ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT",
    })),
  });
  const { embeddings } = await response.json() as { embeddings?: { values: number[] }[] };
  if (embeddings?.length !== input.length || embeddings.some(row => row.values.length !== 1536)) {
    throw new Error("Embedding failed.");
  }
  return embeddings.map(row => row.values);
}
