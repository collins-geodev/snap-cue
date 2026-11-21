import { z } from "zod";
import { defaultProfile, type Profile } from "./domain";

const snippets = z.array(z.string().max(800)).max(25).default([]);
export const resumeProfileSchema = z.object({
  summary: z.string().max(800).default(""),
  skills: snippets, certifications: snippets, experience: snippets, projects: snippets,
  achievements: snippets, education: snippets, languages: snippets,
});
export type ResumeProfile = z.infer<typeof resumeProfileSchema>;
export const emptyResumeProfile = resumeProfileSchema.parse({});
export const resumeFields = ["skills", "certifications", "experience", "projects", "achievements", "education", "languages"] as const;
export const profileFieldLimit = 4000;

function normalized(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

export function groundedResumeProfile(resume: string, extracted: ResumeProfile): ResumeProfile {
  const source = normalized(resume);
  function supported(text: string) {
    const candidate = normalized(text);
    return candidate !== "" && source.includes(candidate) && !/@|https?:\/\//i.test(text);
  }
  const grounded = { ...emptyResumeProfile };
  if (supported(extracted.summary)) grounded.summary = extracted.summary;
  for (const field of resumeFields) grounded[field] = extracted[field].filter(supported);
  return grounded;
}

export function mergeResumeProfile(current: Profile | undefined, extracted: ResumeProfile): Profile {
  const merged = { ...defaultProfile, ...current };
  if (!merged.summary.trim()) merged.summary = extracted.summary.trim();
  for (const field of resumeFields) {
    let value = merged[field] ?? "";
    for (const line of extracted[field]) {
      const snippet = line.replace(/\s+/g, " ").trim();
      if (!snippet || normalized(value).includes(normalized(snippet))) continue;
      const candidate = value.trimEnd() ? `${value.trimEnd()}\n${snippet}` : snippet;
      if (candidate.length <= profileFieldLimit) value = candidate;
    }
    merged[field] = value;
  }
  return merged;
}
