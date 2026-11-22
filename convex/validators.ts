import { v } from "convex/values";
export const category = v.union(v.literal("Behavioral"), v.literal("Technical"), v.literal("Scenario"), v.literal("Leadership"), v.literal("HR"), v.literal("Role-specific"));
export const difficulty = v.union(v.literal("Beginner"), v.literal("Intermediate"), v.literal("Advanced"), v.literal("Executive"));
export const setup = v.object({ category, difficulty, role: v.string(), organization: v.string(), count: v.number(), minutes: v.number() });
export const profile = v.object({ summary: v.string(), skills: v.string(), certifications: v.string(), experience: v.string(), projects: v.string(), achievements: v.string(), education: v.optional(v.string()), languages: v.optional(v.string()) });
const snippets = v.array(v.string());
export const resumeProfile = v.object({ summary: v.string(), skills: snippets, certifications: snippets, experience: snippets, projects: snippets, achievements: snippets, education: snippets, languages: snippets });
export const profileImportStatus = v.union(v.literal("updated"), v.literal("no_changes"), v.literal("unavailable"));
export const settings = v.object({
  language: v.string(), theme: v.union(v.literal("dark"), v.literal("light")),
  length: v.union(v.literal("brief"), v.literal("standard")), model: v.string(),
  retainTranscript: v.boolean(), notifications: v.boolean(), microphone: v.string(),
});
export const assessment = v.object({
  method: v.optional(v.literal("checklist")),
  score: v.number(), feedback: v.string(), improvement: v.string(), dimensions: v.object({
    accuracy: v.number(), relevance: v.number(), clarity: v.number(), structure: v.number(), communication: v.number(), evidence: v.number(),
  }),
});
export const turn = v.object({ question: v.string(), answer: v.string(), assessment });
export const analysis = v.object({ skills: v.array(v.string()), strengths: v.array(v.string()), gaps: v.array(v.string()), questions: v.array(v.string()) });
export const entry = v.object({
  id: v.id("documents"), kind: v.union(v.literal("resume"), v.literal("job")), title: v.string(), organization: v.optional(v.string()),
  text: v.string(), created: v.number(), analysis: v.optional(analysis),
});
