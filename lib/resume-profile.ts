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

type ResumeSection = keyof ResumeProfile | "educationAndCertifications";
const sectionNames: Record<string, ResumeSection> = {
  summary: "summary", "professional summary": "summary", "career summary": "summary",
  "professional profile": "summary", "career profile": "summary", profile: "summary",
  skills: "skills", "core skills": "skills", "technical skills": "skills", "key skills": "skills",
  "core competencies": "skills", competencies: "skills", "technical expertise": "skills", tools: "skills",
  experience: "experience", "professional experience": "experience", "work experience": "experience",
  "employment experience": "experience", "employment history": "experience", "work history": "experience",
  education: "education", "education and training": "education", "academic qualifications": "education",
  "education and qualifications": "education", certifications: "certifications",
  "education and certifications": "educationAndCertifications",
  "professional certifications": "certifications", "certifications and training": "certifications",
  "licenses and certifications": "certifications", training: "certifications",
  projects: "projects", "selected projects": "projects", "key projects": "projects", "major projects": "projects",
  achievements: "achievements", "key achievements": "achievements", "awards and honors": "achievements",
  languages: "languages", "language skills": "languages",
};

export function hasResumeDetails(profile: ResumeProfile) {
  return Boolean(profile.summary.trim() || resumeFields.some(field => profile[field].length));
}

export function extractResumeSections(text: string): ResumeProfile {
  const result = resumeProfileSchema.parse({});
  let section: ResumeSection | undefined;
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim().replace(/^[•▪◦]\s*/, "");
    if (!line || /^page\s+\d+(?:\s+of\s+\d+)?$/i.test(line)) continue;
    const colon = line.indexOf(":");
    const heading = normalized(colon === -1 ? line : line.slice(0, colon)).replace(/\s*&\s*/g, " and ");
    if (Object.hasOwn(sectionNames, heading)) {
      section = sectionNames[heading];
      line = colon === -1 ? "" : line.slice(colon + 1).trim();
    } else if (colon === -1 && /^[A-Z][A-Z &/–-]{2,45}$/.test(line) && /\s/.test(line)) {
      section = undefined;
    }
    if (!section || !line || line.length > 800 || /@|https?:\/\//i.test(line)) continue;

    const field = section === "educationAndCertifications" ? educationOrCertification(line) : section;
    if (!field) continue;
    if (field === "summary") {
      const summary = result.summary ? `${result.summary} ${line}` : line;
      if (summary.length <= 800) result.summary = summary;
    } else if (result[field].length < 25 && !result[field].some(item => normalized(item) === normalized(line))) {
      result[field].push(line);
    }
  }
  return result;
}

function educationOrCertification(line: string): "education" | "certifications" | undefined {
  if (/\b(?:certif\w*|licen[sc]\w*|credential|accredit\w*|training|course)\b/i.test(line)) return "certifications";
  if (/\b(?:university|college|degree|diploma|bachelor|master|doctorate|b\.?sc|m\.?sc|b\.?eng|m\.?eng|ph\.?d|mba|hnd|pgd)\b/i.test(line)) return "education";
}
