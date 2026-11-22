import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { entry, profile, settings, setup, turn, analysis, resumeProfile } from "./validators";
import { assessmentSchema, defaultProfile, defaultSettings, setupSchema, type Profile } from "../lib/domain";

import { identityOf, isConfiguredOwner, ownerOf } from "./identity";
import { recordUsage } from "./admin";
import { mergeResumeProfile, profileFieldLimit } from "../lib/resume-profile";
import { matchJobLocally } from "../lib/job-matching";

const session = v.object({ id: v.id("interviewSessions"), created: v.number(), setup, turns: v.array(turn) });
export const workspace = query({
  args: {},
  returns: v.object({ isOwner: v.boolean(), profile: v.union(profile, v.null()), settings: v.union(settings, v.null()), entries: v.array(entry), sessions: v.array(session) }),
  handler: async ctx => {
    const identity = await identityOf(ctx);
    const owner = identity.tokenIdentifier;
    const [person, preferences, documents, sessions] = await Promise.all([
      ctx.db.query("profiles").withIndex("by_owner", q => q.eq("owner", owner)).unique(),
      ctx.db.query("userSettings").withIndex("by_owner", q => q.eq("owner", owner)).unique(),
      ctx.db.query("documents").withIndex("by_owner", q => q.eq("owner", owner)).order("desc").take(30),
      ctx.db.query("interviewSessions").withIndex("by_owner", q => q.eq("owner", owner)).order("desc").take(100),
    ]);
    return {
      isOwner: isConfiguredOwner(identity),
      profile: person?.value ?? null, settings: preferences?.value ?? null,
      entries: documents.map(({ _id, _creationTime, kind, title, organization, text, analysis }) => ({ id: _id, created: _creationTime, kind, title, organization, text, analysis })),
      sessions: sessions.map(row => ({ id: row._id, created: row._creationTime, setup: row.setup, turns: row.turns })),
    };
  },
});

export const saveProfile = mutation({
  args: { value: profile, changed: v.optional(v.array(v.string())) }, returns: v.null(),
  handler: async (ctx, { value, changed }) => {
    const owner = await ownerOf(ctx);
    if (Object.values(value).some(field => (field?.length ?? 0) > profileFieldLimit)) throw new Error("Profile fields may contain at most 4,000 characters.");
    const row = await ctx.db.query("profiles").withIndex("by_owner", q => q.eq("owner", owner)).unique();
    const next = changed ? { ...(row?.value ?? defaultProfile) } : value;
    if (changed) {
      for (const field of changed) {
        if (!Object.hasOwn(defaultProfile, field)) throw new Error("Unknown profile field.");
        const key = field as keyof Profile;
        next[key] = value[key] ?? "";
      }
    }
    if (row) await ctx.db.patch("profiles", row._id, { value: next });
    else await ctx.db.insert("profiles", { owner, value: next });
    return null;
  },
});
export const saveSettings = mutation({
  args: { value: settings }, returns: v.null(),
  handler: async (ctx, { value }) => {
    const owner = await ownerOf(ctx);
    if (!/^[a-z]{2}$/.test(value.language) || !["gpt-5-mini", "gpt-5.4-mini"].includes(value.model) || value.microphone.length > 256) throw new Error("Unsupported preference.");
    const row = await ctx.db.query("userSettings").withIndex("by_owner", q => q.eq("owner", owner)).unique();
    if (row) await ctx.db.patch("userSettings", row._id, { value });
    else await ctx.db.insert("userSettings", { owner, value });
    return null;
  },
});
export const setTheme = mutation({
  args: { theme: v.union(v.literal("light"), v.literal("dark")) }, returns: v.null(),
  handler: async (ctx, { theme }) => {
    const owner = await ownerOf(ctx);
    const row = await ctx.db.query("userSettings").withIndex("by_owner", q => q.eq("owner", owner)).unique();
    if (row) await ctx.db.patch("userSettings", row._id, { value: { ...row.value, theme } });
    else await ctx.db.insert("userSettings", { owner, value: { ...defaultSettings, theme } });
    return null;
  },
});
export const saveSession = mutation({
  args: { setup, turns: v.array(turn), id: v.optional(v.id("interviewSessions")) }, returns: v.id("interviewSessions"),
  handler: async (ctx, args) => {
    const owner = await ownerOf(ctx);
    const config = setupSchema.parse(args.setup);
    if (!args.turns.length || args.turns.length > config.count || args.turns.some(t => t.answer.length > 6000 || t.question.length > 2000 || !assessmentSchema.safeParse(t.assessment).success || t.assessment.feedback.length > 4000 || t.assessment.improvement.length > 4000)) throw new Error("Invalid interview data.");
    if (args.id) {
      const row = await ctx.db.get("interviewSessions", args.id);
      if (row?.owner !== owner) throw new Error("Interview unavailable.");
      await ctx.db.patch("interviewSessions", row._id, { turns: args.turns });
      return row._id;
    }
    const rows = await ctx.db.query("interviewSessions").withIndex("by_owner", q => q.eq("owner", owner)).take(100);
    if (rows.length >= 100) throw new Error("Delete an older interview to save another.");
    await recordUsage(ctx, owner, "interviews");
    return ctx.db.insert("interviewSessions", { owner, setup: config, turns: args.turns });
  },
});
export const removeSession = mutation({
  args: { id: v.id("interviewSessions") }, returns: v.null(),
  handler: async (ctx, { id }) => {
    if ((await ctx.db.get("interviewSessions", id))?.owner !== await ownerOf(ctx)) throw new Error("Interview unavailable.");
    await ctx.db.delete("interviewSessions", id);
    return null;
  },
});
async function deleteDocument(ctx: MutationCtx, id: DocumentId, storageId?: StorageId) {
  const rows = await ctx.db.query("knowledgeChunks").withIndex("by_document", q => q.eq("document", id)).take(100);
  for (const row of rows) await ctx.db.delete("knowledgeChunks", row._id);
  if (storageId) await ctx.storage.delete(storageId);
  await ctx.db.delete("documents", id);
}
import type { GenericId } from "convex/values";
type DocumentId = GenericId<"documents">;
type StorageId = GenericId<"_storage">;
export const removeDocument = mutation({
  args: { id: v.id("documents") }, returns: v.null(),
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get("documents", id);
    if (!row || row.owner !== await ownerOf(ctx)) throw new Error("Document unavailable.");
    await deleteDocument(ctx, id, row.storageId);
    return null;
  },
});

export const writeDocument = internalMutation({
  args: {
    owner: v.string(), kind: v.union(v.literal("resume"), v.literal("job")), title: v.string(),
    organization: v.optional(v.string()), text: v.string(), storageId: v.optional(v.id("_storage")),
    analysis: v.optional(analysis), replace: v.optional(v.id("documents")), extractedProfile: v.optional(resumeProfile),
    chunks: v.array(v.object({ text: v.string(), embedding: v.array(v.float64()) })),
    embeddingModel: v.optional(v.literal("gemini-embedding-001")),
  }, returns: v.object({ id: v.id("documents"), profileUpdated: v.boolean() }),
  handler: async (ctx, { replace, chunks, extractedProfile, embeddingModel, ...document }) => {
    let storageId = document.storageId;
    if (replace) {
      const old = await ctx.db.get("documents", replace);
      if (!old || old.owner !== document.owner || old.kind !== document.kind) throw new Error("Document unavailable.");
      if (!storageId && document.text === old.text) storageId = old.storageId;
      await deleteDocument(ctx, old._id, storageId === old.storageId ? undefined : old.storageId);
    }
    const rows = await ctx.db.query("documents").withIndex("by_owner", q => q.eq("owner", document.owner)).take(30);
    if (rows.length >= 30) throw new Error("Delete an existing document to upload another.");
    const id = await ctx.db.insert("documents", { ...document, storageId });
    for (const chunk of chunks) {
      await ctx.db.insert("knowledgeChunks", {
        ...chunk, owner: document.owner, document: id, model: embeddingModel ?? "text-embedding-3-small",
        ...(embeddingModel && { geminiOwner: document.owner, geminiDocument: id }),
      });
    }
    let profileUpdated = false;
    if (document.kind === "resume" && extractedProfile) {
      const row = await ctx.db.query("profiles").withIndex("by_owner", q => q.eq("owner", document.owner)).unique();
      const next = mergeResumeProfile(row?.value, extractedProfile);
      const previous = row?.value ?? defaultProfile;
      profileUpdated = (Object.keys(defaultProfile) as (keyof Profile)[]).some(field => (previous[field] ?? "") !== (next[field] ?? ""));
      if (profileUpdated) {
        if (row) await ctx.db.patch("profiles", row._id, { value: next });
        else await ctx.db.insert("profiles", { owner: document.owner, value: next });
      }
    }
    return { id, profileUpdated };
  },
});
export const practiceSkill = internalQuery({
  args: { owner: v.string(), resume: v.optional(v.id("documents")), job: v.optional(v.id("documents")) },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { owner, resume, job }) => {
    const cv = resume ? await ctx.db.get("documents", resume) : null;
    const position = job ? await ctx.db.get("documents", job) : null;
    if ((resume && (cv?.owner !== owner || cv.kind !== "resume")) ||
        (job && (position?.owner !== owner || position.kind !== "job"))) throw new Error("Document unavailable.");
    const jobSkills = position ? position.analysis?.skills ?? matchJobLocally(position.text, []).skills : [];
    const cvSkills = cv ? matchJobLocally(cv.text, []).skills : [];
    const skill = jobSkills.find(value => cvSkills.includes(value)) ?? jobSkills[0] ?? cvSkills[0];
    return skill?.slice(0, 120) || null;
  },
});

export const matchingResumes = internalQuery({
  args: { owner: v.string(), resume: v.optional(v.id("documents")) },
  returns: v.array(v.string()),
  handler: async (ctx, { owner, resume }) => {
    if (resume) {
      const document = await ctx.db.get("documents", resume);
      if (!document || document.owner !== owner || document.kind !== "resume") throw new Error("Document unavailable.");
      return [document.text];
    }
    const rows = await ctx.db.query("documents").withIndex("by_owner", q => q.eq("owner", owner)).take(30);
    return rows.filter(document => document.kind === "resume").map(document => document.text);
  },
});

export const context = internalQuery({
  args: { owner: v.string(), ids: v.array(v.id("knowledgeChunks")), resume: v.optional(v.id("documents")), job: v.optional(v.id("documents")), includeResumeExcerpt: v.optional(v.boolean()) },
  returns: v.object({ sources: v.array(v.object({ label: v.string(), text: v.string() })), profile: v.union(profile, v.null()) }),
  handler: async (ctx, args) => {
    for (const [id, kind] of [[args.resume, "resume"], [args.job, "job"]] as const) {
      if (!id) continue;
      const row = await ctx.db.get("documents", id);
      if (row?.owner !== args.owner || row.kind !== kind) throw new Error("Document unavailable.");
    }
    const record = await ctx.db.query("profiles").withIndex("by_owner", q => q.eq("owner", args.owner)).unique();
    const sources = [];
    let hasResumeSource = false;
    for (const id of args.ids) {
      const chunk = await ctx.db.get("knowledgeChunks", id);
      if (chunk?.owner !== args.owner) continue;
      const doc = await ctx.db.get("documents", chunk.document);
      if (doc?.owner === args.owner && (doc.kind === "resume" ? !args.resume || args.resume === doc._id : args.job === doc._id)) {
        sources.push({ label: `[${doc.kind.toUpperCase()} ${sources.length + 1}] ${doc.title}`, text: chunk.text });
        hasResumeSource ||= doc.kind === "resume";
      }
    }
    if (args.includeResumeExcerpt && args.resume && !hasResumeSource) {
      const resume = await ctx.db.get("documents", args.resume);
      if (resume?.owner === args.owner && resume.kind === "resume") {
        sources.unshift({ label: `[RESUME EXCERPT] ${resume.title}`, text: resume.text.slice(0, 2500) });
      }
    }
    return { sources, profile: record?.value ?? null };
  },
});
export const quota = mutation({
  args: { kind: v.union(v.literal("ai"), v.literal("upload"), v.literal("extract"), v.literal("speech"), v.literal("live")) }, returns: v.null(),
  handler: async (ctx, { kind }) => {
    const owner = await ownerOf(ctx);
    const max = { ai: 40, upload: 12, extract: 12, speech: 30, live: 8 }[kind];
    const row = await ctx.db.query("usageEvents").withIndex("by_owner_kind", q => q.eq("owner", owner).eq("kind", kind)).unique();
    const now = Date.now();
    const timestamps = (row?.timestamps ?? []).filter(time => now - time < 3600_000);
    if (timestamps.length >= max) throw new Error("Hourly usage limit reached.");
    timestamps.push(now);
    if (row) await ctx.db.patch("usageEvents", row._id, { timestamps });
    else await ctx.db.insert("usageEvents", { owner, kind, timestamps });
    if (kind === "ai") await recordUsage(ctx, owner, "aiRequests");
    if (kind === "speech") await recordUsage(ctx, owner, "transcriptionRequests");
    if (kind === "live") await recordUsage(ctx, owner, "liveSessions");
    return null;
  },
});
export const consent = mutation({
  args: { retain: v.boolean() }, returns: v.null(),
  handler: async (ctx, { retain }) => {
    const owner = await ownerOf(ctx);
    const rows = await ctx.db.query("consentRecords").withIndex("by_owner", q => q.eq("owner", owner)).take(100);
    if (rows.length === 100) await ctx.db.delete("consentRecords", rows[0]._id);
    await ctx.db.insert("consentRecords", { owner, retain, noticeVersion: "1" });
    return null;
  },
});
export const retainLive = mutation({
  args: { text: v.string() }, returns: v.null(),
  handler: async (ctx, { text }) => {
    const owner = await ownerOf(ctx);
    const consent = await ctx.db.query("consentRecords").withIndex("by_owner", q => q.eq("owner", owner)).order("desc").first();
    if (!consent?.retain || !text.trim() || text.length > 25000) throw new Error("Transcript retention is unavailable.");
    const rows = await ctx.db.query("liveTranscripts").withIndex("by_owner", q => q.eq("owner", owner)).take(30);
    if (rows.length === 30) throw new Error("Transcript storage is full.");
    await ctx.db.insert("liveTranscripts", { owner, text });
    return null;
  },
});
export const transcripts = query({
  args: {}, returns: v.array(v.object({ id: v.id("liveTranscripts"), created: v.number(), text: v.string() })),
  handler: async ctx => {
    const owner = await ownerOf(ctx);
    const rows = await ctx.db.query("liveTranscripts").withIndex("by_owner", q => q.eq("owner", owner)).order("desc").take(30);
    return rows.map(row => ({ id: row._id, created: row._creationTime, text: row.text }));
  },
});
export const removeTranscript = mutation({
  args: { id: v.id("liveTranscripts") }, returns: v.null(),
  handler: async (ctx, { id }) => {
    if ((await ctx.db.get("liveTranscripts", id))?.owner !== await ownerOf(ctx)) throw new Error("Transcript unavailable.");
    await ctx.db.delete("liveTranscripts", id);
    return null;
  },
});
export const erase = mutation({
  args: {}, returns: v.null(),
  handler: async ctx => {
    const owner = await ownerOf(ctx);
    const docs = await ctx.db.query("documents").withIndex("by_owner", q => q.eq("owner", owner)).take(30);
    for (const doc of docs) await deleteDocument(ctx, doc._id, doc.storageId);
    for (const table of ["profiles", "userSettings", "interviewSessions", "consentRecords", "liveTranscripts"] as const) {
      const rows = await ctx.db.query(table).withIndex("by_owner", q => q.eq("owner", owner)).take(100);
      for (const row of rows) await ctx.db.delete(table, row._id);
    }
    const events = await ctx.db.query("usageEvents").withIndex("by_owner_kind", q => q.eq("owner", owner)).take(5);
    for (const row of events) await ctx.db.delete("usageEvents", row._id);
    const activity = await ctx.db.query("adminUsageActivity").withIndex("by_owner", q => q.eq("owner", owner)).unique();
    if (activity) await ctx.db.delete("adminUsageActivity", activity._id);
    return null;
  },
});
