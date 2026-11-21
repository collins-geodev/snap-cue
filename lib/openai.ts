export async function openAI(path: string, body: unknown, signal?: AbortSignal) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("The AI service is unavailable.");
  const multipart = body instanceof FormData;
  const response = await fetch("https://api.openai.com/v1/" + path, {
    method: "POST", cache: "no-store",
    headers: { Authorization: "Bearer " + key, ...(multipart ? {} : { "Content-Type": "application/json" }) },
    body: multipart ? body : JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(45_000)]) : AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error("The AI service could not complete the request.");
  return response;
}
export async function complete(instructions: string, input: unknown, model = "gpt-5-mini", json = false) {
  const response = await openAI("responses", {
    model, instructions, input: JSON.stringify(input), max_output_tokens: 3000,
    ...(json ? { text: { format: { type: "json_object" } } } : {}),
  });
  const data = await response.json() as { output?: { content?: { type: string; text?: string }[] }[] };
  const result = data.output?.flatMap(item => item.content ?? []).filter(item => item.type === "output_text").map(item => item.text).join("");
  if (!result) throw new Error("The AI service returned no answer.");
  return result;
}
export async function embed(input: string[]) {
  const response = await openAI("embeddings", { model: "text-embedding-3-small", input });
  const data = await response.json() as { data: { index: number; embedding: number[] }[] };
  const ordered = data.data.sort((left, right) => left.index - right.index);
  if (ordered.length !== input.length || ordered.some(row => row.embedding.length !== 1536)) throw new Error("Embedding failed.");
  return ordered.map(row => row.embedding);
}
