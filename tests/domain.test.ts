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

function samplePdf(text: string) {
  const stream = text ? `BT /F1 12 Tf 72 720 Td (${text}) Tj ET\n` : "";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => {
    const offset = Buffer.byteLength(pdf);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const crossReference = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  return `${pdf}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${crossReference}\n%%EOF\n`;
}

test("PDF extraction reads text without a canvas and identifies image-only files", async () => {
  const options = { type: "application/pdf" };
  const readable = new File([samplePdf("Spatial data engineering")], "cv.pdf", options);
  assert.equal((await extract(readable)).text, "Spatial data engineering");
  const blank = new File([samplePdf("")], "scan.pdf", options);
  await assert.rejects(extract(blank), /no selectable text/);
  await assert.rejects(extract(new File(["%PDF-1.4\nBroken content"], "broken.pdf", options)), /Could not open this PDF/);
});
