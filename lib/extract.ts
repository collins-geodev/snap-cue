import { maxFile } from "./domain";

export async function extract(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const mime = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", txt: "text/plain" } as const;
  if (!file.size || file.size > maxFile || (ext !== "pdf" && ext !== "docx" && ext !== "txt")) throw new Error("Choose a PDF, DOCX or TXT file up to 4 MB.");
  const type = mime[ext];
  if (file.type && file.type !== "application/octet-stream" && file.type !== type) throw new Error("The file type does not match its extension.");
  const data = Buffer.from(await file.arrayBuffer());
  let text: string;
  if (ext === "pdf") {
    if (data.subarray(0, 5).toString() !== "%PDF-") throw new Error("Invalid PDF.");
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(data) });
    try { text = (await parser.getText()).text; } finally { await parser.destroy(); }
  } else if (ext === "docx") {
    validateDocx(data);
    const mammoth = await import("mammoth");
    text = (await mammoth.extractRawText({ buffer: data })).value;
  } else {
    if (data.includes(0)) throw new Error("Invalid text file.");
    text = new TextDecoder("utf-8", { fatal: true }).decode(data);
  }
  text = text.replaceAll("\u0000", "").trim();
  if (!text || text.length > 55000) throw new Error("The document must have 1–55,000 extractable characters.");
  return { text, type, base64: data.toString("base64") };
}
function validateDocx(data: Buffer) {
  if (data.length < 22 || data.readUInt32LE(0) !== 0x04034b50) throw new Error("Invalid DOCX.");
  const eocd = data.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0 || eocd + 22 > data.length || eocd + 22 + data.readUInt16LE(eocd + 20) !== data.length) throw new Error("Invalid DOCX directory.");
  const entries = data.readUInt16LE(eocd + 10);
  const centralLength = data.readUInt32LE(eocd + 12);
  let offset = data.readUInt32LE(eocd + 16);
  if (!entries || entries > 512 || offset + centralLength !== eocd || data.readUInt32LE(eocd + 4) !== 0) throw new Error("Unsupported DOCX archive.");
  let total = 0;
  let hasDocument = false;
  for (let index = 0; index < entries; index++) {
    if (offset + 46 > eocd || data.readUInt32LE(offset) !== 0x02014b50) throw new Error("Invalid DOCX directory.");
    const nameLength = data.readUInt16LE(offset + 28);
    const entryEnd = offset + 46 + nameLength + data.readUInt16LE(offset + 30) + data.readUInt16LE(offset + 32);
    if (entryEnd > eocd) throw new Error("Invalid DOCX entry.");
    const name = data.toString("utf8", offset + 46, offset + 46 + nameLength);
    total += data.readUInt32LE(offset + 24);
    if (total > 20 * 1024 * 1024) throw new Error("The expanded DOCX is too large.");
    if (name === "word/document.xml") hasDocument = true;
    offset = entryEnd;
  }
  if (offset !== eocd || !hasDocument) throw new Error("Invalid DOCX document.");
}
