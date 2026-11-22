import { z } from "zod";
import { authenticatedClient, sameOrigin } from "@/lib/server-auth";
import { openAI } from "@/lib/openai";
import { grounding } from "@/lib/domain";
import { api } from "@/convex/_generated/api";
import type { GenericId } from "convex/values";

const input = z.object({ question: z.string().trim().min(1).max(2000), style: z.enum(["Concise", "STAR", "Technical"]), expanded: z.boolean(), resume: z.string().max(80).optional(), job: z.string().max(80).optional() });
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
  const secured = await authenticatedClient();
  if (!secured) return Response.json({ error: "Cloud sign-in is required." }, { status: 401 });
  const start = performance.now();
  try {
    const { resume, job, ...args } = input.parse(await request.json());
    const { settings } = await secured.client.query(api.store.workspace, {});
    const selection = { resume: resume as GenericId<"documents"> | undefined, job: job as GenericId<"documents"> | undefined };
    const length = args.expanded ? "expanded" : settings?.length;
    const headers = { "Content-Type": "text/event-stream", "Cache-Control": "no-store" };
    const answer = await secured.client.action(api.intelligence.geminiAnswer, { question: args.question, style: args.style, length, ...selection });
    if (answer !== null) {
      const delta = JSON.stringify({ type: "response.output_text.delta", delta: answer });
      return new Response(`data: ${delta}\n\ndata: {"type":"response.completed"}\n\n`, { headers });
    }
    const evidence = await secured.client.action(api.intelligence.answerContext, { question: args.question, ...selection });
    const upstream = await openAI("responses", {
      model: settings?.model ?? "gpt-5-mini", stream: true, max_output_tokens: 2000,
      instructions: grounding + " Use plain text. Give a useful suggested answer and 3–5 short talking points. Include a labeled source-quality line. Distinguish candidate-provided claims from general guidance and attach source labels only where supported. If evidence is absent, suggest a fill-in outline.",
      input: JSON.stringify({ ...args, length, evidence }),
    }, request.signal);
    return new Response(upstream.body, { headers: { ...headers, "Server-Timing": `setup;dur=${Math.round(performance.now() - start)}` } });
  } catch {
    return Response.json({ error: "The answer assistant is unavailable. Try again shortly." }, { status: 502 });
  }
}
