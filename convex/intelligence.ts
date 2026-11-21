"use node";
import { makeFunctionReference, type FunctionReference } from "convex/server";
import { v, type GenericId } from "convex/values";
import { action } from "./_generated/server";
import type { DataModel } from "./_generated/dataModel";
import type { GenericActionCtx } from "convex/server";
import { chunkText, grounding, jobAnalysisSchema, assessmentSchema, setupSchema, type Profile } from "../lib/domain";
import { complete, embed } from "../lib/openai";
import { analysis, assessment, setup, category, difficulty } from "./validators";
import { ownerOf } from "./identity";

type Doc = GenericId<"documents">;
const ref = <T extends "query" | "mutation">(name: string) => makeFunctionReference<T>(name);
const getContext = ref<"query">("store:context") as FunctionReference<"query", "public", {
  owner: string; ids: GenericId<"knowledgeChunks">[]; resume?: Doc; job?: Doc;
}, { sources: { label: string; text: string }[]; profile: Profile | null }>;
const budget = ref<"mutation">("store:quota");
const selection = { resume: v.optional(v.id("documents")), job: v.optional(v.id("documents")) };
const file = v.object({ base64: v.string(), type: v.string() });
const ingestFields = { kind: v.union(v.literal("resume"), v.literal("job")), title: v.string(), organization: v.optional(v.string()), text: v.string(), file: v.optional(file), replace: v.optional(v.id("documents")), resume: v.optional(v.id("documents")) };

async function retrieve(ctx: GenericActionCtx<DataModel>, owner: string, query: string, resume?: Doc, job?: Doc) {
  if (resume || job) await ctx.runQuery(getContext, { owner, ids: [], resume, job });
  const [vector] = await embed([query.slice(0, 6000)]);
  const ids: GenericId<"knowledgeChunks">[] = [];
  if (!resume) {
    const hits = await ctx.vectorSearch("knowledgeChunks", "by_embedding", { vector, limit: 20, filter: q => q.eq("owner", owner) });
    ids.push(...hits.map(hit => hit._id));
  }
  for (const document of [resume, job]) {
      if (!document) continue;
      // The selected document was checked before searching.
      const hits = await ctx.vectorSearch("knowledgeChunks", "by_embedding", { vector, limit: 4, filter: q => q.eq("document", document) });
      ids.unshift(...hits.map(hit => hit._id));
  }
  const context = await ctx.runQuery(getContext, { owner, ids: [...new Set(ids)], resume, job });
  return { ...context, sources: context.sources.slice(0, 8) };
}

export const ingest = action({
  args: ingestFields, returns: v.object({ id: v.id("documents"), analysis: v.optional(analysis) }),
  handler: async (ctx, args): Promise<{id: Doc; analysis?: ReturnType<typeof jobAnalysisSchema.parse>}> => {
    const owner = await ownerOf(ctx);
    await ctx.runMutation(budget, { kind: "upload" });
    const text = args.text.replaceAll("\u0000", "").trim();
    if (!text || text.length > 55000 || !args.title.trim() || args.title.length > 160 || (args.organization?.length ?? 0) > 120) throw new Error("Check the document length and title.");
    const chunks = chunkText(text);
    if (chunks.length > 100) throw new Error("This document contains too many short tokens.");
    const embeddings = await embed(chunks);
    const report = args.kind === "job" ? jobAnalysisSchema.parse(JSON.parse(await complete(
      grounding + " Compare the job with candidate evidence. Return JSON with string arrays skills, strengths, gaps, questions. Identify gaps in supplied evidence and predict role-specific questions.",
      { job: text, candidate: await retrieve(ctx, owner, text, args.resume) }, undefined, true,
    ))) : undefined;
    let storageId;
    if (args.file) {
      if (args.file.base64.length > 5_592_408 || !["application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(args.file.type)) throw new Error("Unsupported document.");
      const bytes = Uint8Array.from(atob(args.file.base64), character => character.charCodeAt(0));
      if (args.file.type === "application/pdf" && !new TextDecoder().decode(bytes.slice(0, 5)).startsWith("%PDF-")) throw new Error("Invalid PDF.");
      if (args.file.type.includes("wordprocessingml") && (bytes[0] !== 80 || bytes[1] !== 75)) throw new Error("Invalid DOCX.");
      if (args.file.type === "text/plain" && bytes.includes(0)) throw new Error("Invalid text file.");
      storageId = await ctx.storage.store(new Blob([bytes], { type: args.file.type }));
    }
    try {
      const id: Doc = await ctx.runMutation(ref<"mutation">("store:writeDocument"), {
        owner, title: args.title.trim(), kind: args.kind, organization: args.organization, text,
        storageId, analysis: report, replace: args.replace,
        chunks: chunks.map((chunk, i) => ({ text: chunk, embedding: embeddings[i] })),
      });
      return { id, analysis: report };
    } catch (error) {
      if (storageId) await ctx.storage.delete(storageId);
      throw error;
    }
  },
});
export const question = action({
  args: { setup, previous: v.array(v.string()), ...selection }, returns: v.string(),
  handler: async (ctx, args) => {
    const owner = await ownerOf(ctx);
    await ctx.runMutation(budget, { kind: "ai" });
    const config = setupSchema.parse(args.setup);
    if (args.previous.length > 10 || args.previous.some(item => item.length > 2000)) throw new Error("Unexpected interview history.");
    const evidence = await retrieve(ctx, owner, `${config.role} ${config.category} ${config.organization}`, args.resume, args.job);
    return (await complete(grounding + " Ask exactly one focused interview question. Adapt to the role, category, and difficulty. Avoid repeating prior questions. Return plain text only.", { config, previous: args.previous, evidence })).trim().slice(0, 2000);
  },
});
export const evaluate = action({
  args: { question: v.string(), answer: v.string(), category, difficulty, ...selection }, returns: assessment,
  handler: async (ctx, args) => {
    const owner = await ownerOf(ctx);
    if (!args.answer.trim() || args.answer.length > 6000 || args.question.length > 2000) throw new Error("Check the answer length.");
    await ctx.runMutation(budget, { kind: "ai" });
    const evidence = await retrieve(ctx, owner, args.question, args.resume, args.job);
    return assessmentSchema.parse(JSON.parse(await complete(grounding + " Assess only what the response demonstrates. Evaluate confidence through wording, never infer emotional or personal traits. Use STAR if relevant. Return JSON: score (0–100), feedback, improvement, dimensions (accuracy, relevance, clarity, structure, communication, evidence, each 0–100).", { ...args, evidence }, undefined, true)));
  },
});
export const answerContext = action({
  args: { question: v.string(), ...selection },
  returns: v.object({ sources: v.array(v.object({ label: v.string(), text: v.string() })), profile: v.union(v.null(), v.object({ summary: v.string(), skills: v.string(), certifications: v.string(), experience: v.string(), projects: v.string(), achievements: v.string() })) }),
  handler: async (ctx, args) => {
    const owner = await ownerOf(ctx);
    if (!args.question.trim() || args.question.length > 2000) throw new Error("Invalid question.");
    await ctx.runMutation(budget, { kind: "ai" });
    return retrieve(ctx, owner, args.question, args.resume, args.job);
  },
});
