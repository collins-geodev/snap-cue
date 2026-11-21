import assert from "node:assert/strict";
import { test } from "node:test";
import { assessmentSchema, chunkText, demoAssessment, setupSchema } from "../lib/domain";
import { extract } from "../lib/extract";
import { openAI, embed } from "../lib/openai";

test("practice rules trim role and enforce duration and question count", () => {
  const setup = { category: "Technical", difficulty: "Advanced", role: " GIS Engineer ", organization: "", count: "3", minutes: "10" };
  assert.equal(setupSchema.parse(setup).role, "GIS Engineer");
  assert.equal(setupSchema.parse(setup).count, 3);
  assert.equal(setupSchema.safeParse({ ...setup, count: 11 }).success, false);
  assert.equal(setupSchema.safeParse({ ...setup, minutes: 0 }).success, false);
  assert.equal(assessmentSchema.safeParse(demoAssessment("An example response.")).success, true);
});
test("chunks cover complete input and retain overlap", () => {
  const input = Array.from({ length: 250 }, (_, index) => String(index)).join(" ");
  const chunks = chunkText(input);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].split(" ").length, 170);
  assert.equal(chunks[1].split(" ")[0], "145");
  assert.equal(chunks[1].split(" ").at(-1), "249");
  assert.deepEqual(chunkText("   "), []);
});
test("document extraction validates MIME, contents, size and extractable text", async () => {
  const result = await extract(new File(["  Resume content  "], "cv.txt", { type: "text/plain" }));
  assert.equal(result.text, "Resume content");
  await assert.rejects(extract(new File(["wrong"], "cv.pdf", { type: "text/plain" })), /file type/);
  await assert.rejects(extract(new File(["wrong"], "cv.pdf", { type: "application/pdf" })), /Invalid PDF/);
  await assert.rejects(extract(new File(["PK"], "cv.docx")), /DOCX/);
  await assert.rejects(extract(new File([" "], "cv.txt")), /extractable/);
  await assert.rejects(extract(new File([new Uint8Array(4 * 1024 * 1024 + 1)], "cv.txt")), /4 MB/);
});
test("OpenAI requests use server authentication and validate embedding dimensions", async t => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-secret";
  t.after(() => { if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous; });
  const fetchMock = t.mock.method(globalThis, "fetch", async (_url: string, inputs: RequestInit) => {
    assert.equal(new Headers(inputs.headers).get("Authorization"), "Bearer test-secret");
    return Response.json({ data: [{ index: 0, embedding: [1, 2] }] });
  });
  await assert.rejects(embed(["example"]), /Embedding failed/);
  assert.equal(fetchMock.mock.callCount(), 1);
  fetchMock.mock.mockImplementation(async () => new Response("upstream private error", { status: 500 }));
  await assert.rejects(openAI("responses", {}), { message: "The AI service could not complete the request." });
});
