import type { JobAnalysis } from "./domain";

const skills = [
  "ArcGIS", "QGIS", "GIS", "spatial analysis", "remote sensing", "Python", "JavaScript", "TypeScript",
  "React", "Node.js", "Java", "C++", "C#", ".NET", "SQL", "PostgreSQL", "PostGIS", "MongoDB",
  "data analysis", "data engineering", "machine learning", "ETL", "Power BI", "Tableau", "Excel",
  "AWS", "Azure", "Google Cloud", "Docker", "Kubernetes", "Git", "CI/CD", "API design",
  "project management", "stakeholder management", "communication", "leadership", "customer service",
];

function mentions(text: string, skill: string) {
  const literal = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}_])${literal}(?=$|[^\\p{L}\\p{N}_])`, "iu").test(text);
}

export function matchJobLocally(job: string, resumes: string[]): JobAnalysis {
  const required = skills.filter(skill => mentions(job, skill));
  const matches = required.filter(skill => resumes.some(resume => mentions(resume, skill)));
  return {
    skills: required,
    strengths: matches.map(skill => `${skill} appears in the selected CV evidence.`),
    gaps: required.filter(skill => !matches.includes(skill)).map(skill => `No CV mention of ${skill} was found.`),
    questions: required.length
      ? required.slice(0, 5).map(skill => `Can you describe a project where you used ${skill} and explain your contribution?`)
      : ["Which project best demonstrates the skills required for this role?"],
  };
}
