import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { profile, settings, setup, turn, analysis } from "./validators";

export default defineSchema({
  profiles: defineTable({ owner: v.string(), value: profile }).index("by_owner", ["owner"]),
  userSettings: defineTable({ owner: v.string(), value: settings }).index("by_owner", ["owner"]),
  documents: defineTable({
    owner: v.string(), kind: v.union(v.literal("resume"), v.literal("job")), title: v.string(),
    organization: v.optional(v.string()), text: v.string(), storageId: v.optional(v.id("_storage")),
    analysis: v.optional(analysis),
  }).index("by_owner", ["owner"]),
  knowledgeChunks: defineTable({
    owner: v.string(), document: v.id("documents"), text: v.string(), embedding: v.array(v.float64()),
    model: v.literal("text-embedding-3-small"),
  }).index("by_document", ["document"]).vectorIndex("by_embedding", {
    vectorField: "embedding", dimensions: 1536, filterFields: ["owner", "document"],
  }),
  interviewSessions: defineTable({ owner: v.string(), setup, turns: v.array(turn) }).index("by_owner", ["owner"]),
  consentRecords: defineTable({ owner: v.string(), retain: v.boolean(), noticeVersion: v.literal("1") }).index("by_owner", ["owner"]),
  liveTranscripts: defineTable({ owner: v.string(), text: v.string() }).index("by_owner", ["owner"]),
  dailyAdminUsage: defineTable({
    day: v.string(), interviews: v.number(), aiRequests: v.number(), transcriptionRequests: v.number(),
    liveSessions: v.number(), activeUserDays: v.number(),
  }).index("by_day", ["day"]),
  adminUsageActivity: defineTable({ owner: v.string(), day: v.string() }).index("by_owner", ["owner"]),
  usageEvents: defineTable({ owner: v.string(), kind: v.string(), timestamps: v.array(v.number()) }).index("by_owner_kind", ["owner", "kind"]),
});
