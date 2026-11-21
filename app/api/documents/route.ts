import { authenticatedClient, sameOrigin } from "@/lib/server-auth";
import { DocumentReadError, extract } from "@/lib/extract";
import { api } from "@/convex/_generated/api";
import type { GenericId } from "convex/values";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
  const secured = await authenticatedClient();
  if (!secured) return Response.json({ error: "Cloud sign-in is required." }, { status: 401 });
  if (Number(request.headers.get("content-length")) > 4_400_000) return Response.json({ error: "File is too large." }, { status: 413 });
  try {
    const form = await request.formData();
    const title = String(form.get("title") ?? "").trim();
    const kind = form.get("kind");
    if (!title || title.length > 160 || (kind !== "resume" && kind !== "job")) return Response.json({ error: "Enter a document title." }, { status: 400 });
    const selected = form.get("file");
    let file;
    if (selected instanceof File && selected.size) {
      await secured.client.mutation(api.store.quota, { kind: "extract" });
      try {
        file = await extract(selected);
      } catch (error) {
        const message = error instanceof DocumentReadError ? error.message : "Could not read this file. Re-export it or paste the document text.";
        return Response.json({ error: message }, { status: 400 });
      }
    }
    const result = await secured.client.action(api.intelligence.ingest, {
      title, kind, organization: String(form.get("organization") ?? "").trim(), text: file?.text ?? String(form.get("text") ?? ""),
      file: file && { base64: file.base64, type: file.type },
      replace: (form.get("replace") || undefined) as GenericId<"documents"> | undefined,
      resume: (form.get("resume") || undefined) as GenericId<"documents"> | undefined,
    });
    return Response.json(result);
  } catch {
    return Response.json({ error: "Could not save the document. Check the title, text, and your upload quota." }, { status: 400 });
  }
}
