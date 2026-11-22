import type { Entry } from "./domain";
import { matchJobLocally } from "./job-matching";

export type AnswerStyle = "Concise" | "STAR" | "Technical";

export function localAnswer(question: string, style: AnswerStyle, expanded: boolean, resume?: Entry, job?: Entry) {
  const arcgis = /^(?:what (?:is|do you mean by)|define)\s+arcgis\s+pro[?.!\s]*$/iu.test(question.trim());
  const definition = /^(?:what (?:is|are)|define|explain what)\b/iu.test(question.trim());
  const format = style === "STAR"
    ? "Describe the situation, your task, the action you took, and the result."
    : style === "Technical"
      ? "State the inputs and constraints, explain your workflow, and describe the checks you would run."
      : "Give the main point first, then support it with one example you can verify.";
  const lines = arcgis
    ? [
        "ArcGIS Pro is Esri’s desktop GIS application for creating maps, managing geographic data, and performing spatial analysis.",
        "• Map and visualize geographic data in 2D and 3D.",
        "• Use geoprocessing tools to prepare data and answer questions such as which features fall within a flood zone.",
        ...(style === "Concise" ? [] : [`• For a follow-up example, ${format[0].toLowerCase() + format.slice(1)}`]),
      ]
    : [
        "Practice outline",
        definition ? "• Define the term in one sentence using a source you can verify." : "• Answer the question directly in your opening sentence.",
        `• ${format}`,
        definition ? "• Explain where the concept is used and give a concrete example." : "• Close with the outcome or explain how you would measure success.",
      ];
  const resumeSkills = resume ? matchJobLocally(resume.text, []).skills : [];
  const evidence = matchJobLocally(question, []).skills.find(skill => resumeSkills.includes(skill));
  if (evidence) lines.push(`• Your selected CV mentions ${evidence}. Use a specific example if it supports your answer.`);
  if (expanded) {
    lines.push(job ? "• Connect the example to a responsibility in the selected job description." : "• Explain one trade-off or limitation and how you would address it.");
    if (arcgis) lines.push("• Close by explaining how you would check the analysis and share the result.");
  }
  lines.push(arcgis
    ? "Source: Esri’s ArcGIS Pro overview. Practice prompts are general guidance."
    : "Source quality: General guidance. Verify details before using this outline.");
  return lines.join("\n");
}
