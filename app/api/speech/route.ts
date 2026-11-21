import { authenticatedClient, sameOrigin } from "@/lib/server-auth";
import { openAI } from "@/lib/openai";
import { api } from "@/convex/_generated/api";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
  const secured = await authenticatedClient();
  if (!secured) return Response.json({ error: "Cloud sign-in is required." }, { status: 401 });
  const start = performance.now();
  try {
    const { settings } = await secured.client.query(api.store.workspace, {});
    const language = settings?.language ?? "en";
    if (new URL(request.url).searchParams.has("live")) {
      const consent = await request.json();
      if (consent.allowed !== true || consent.recordingAllowed !== true) return Response.json({ error: "Confirm participant permission first." }, { status: 400 });
      await secured.client.mutation(api.store.quota, { kind: "live" });
      await secured.client.mutation(api.store.consent, { retain: settings?.retainTranscript ?? false });
      const upstream = await openAI("realtime/client_secrets", {
        expires_after: { anchor: "created_at", seconds: 60 },
        session: { type: "transcription", audio: { input: { transcription: { model: "gpt-live-transcribe", languages: [language], delay: "low" } } } },
      }, request.signal);
      const secret = await upstream.json();
      return Response.json({ token: secret.value });
    }
    if (Number(request.headers.get("content-length")) > 4_400_000) return Response.json({ error: "Audio is too large." }, { status: 413 });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size < 64 || file.size > 4 * 1024 * 1024 || !/^(audio\/(webm|mp4|mpeg|wav|ogg)|video\/webm)(;.*)?$/.test(file.type)) {
      return Response.json({ error: "Choose a supported recording up to 4 MB." }, { status: 400 });
    }
    await secured.client.mutation(api.store.quota, { kind: "speech" });
    form.set("model", "gpt-transcribe");
    form.set("language", language);
    const upstream = await openAI("audio/transcriptions", form, request.signal);
    const data = await upstream.json();
    return Response.json({ text: data.text, latency: Math.round(performance.now() - start) });
  } catch {
    return Response.json({ error: "Transcription is unavailable. Check the connection or usage limit and try again." }, { status: 502 });
  }
}
