import type { Assessment, Setup } from "./domain";

export function localQuestion(setup: Setup, previous: string[], skill?: string) {
  const { category, difficulty, role } = setup;
  const focus = skill ?? `a core skill for a ${role}`;
  const opening: Record<Setup["category"], string> = {
    Behavioral: `Tell me about a project that prepared you for a ${role} position. What did you personally contribute?`,
    Technical: skill
      ? `How would you use ${skill} to solve a problem as a ${role}, and how would you validate the result?`
      : `How would you validate the quality of a technical solution before delivering it as a ${role}?`,
    Scenario: `As a ${role}, how would you respond if a stakeholder changed a key requirement just before delivery?`,
    Leadership: `Tell me how you would help a team of ${role} colleagues reach agreement on a difficult decision.`,
    HR: `Why are you interested in the ${role} position, and which experience best prepares you for it?`,
    "Role-specific": `What would you prioritize in your first month as a ${role}, and why?`,
  };
  const followUp: Record<Setup["difficulty"], string> = {
    Beginner: `Walk me through a simple task involving ${focus}. How would you check your work?`,
    Intermediate: `Describe a trade-off involving ${focus}. What alternatives did you consider?`,
    Advanced: `How would you diagnose a recurring failure involving ${focus} with incomplete evidence?`,
    Executive: `How would you justify investment in ${focus} to stakeholders with competing priorities?`,
  };
  const prompts = [
    opening[category], followUp[difficulty],
    "Tell me about a project that went off track. How did you identify the problem and respond?",
    "How would you explain a complex decision to a stakeholder who is unfamiliar with your work?",
    "Describe a time you improved a process. How did you measure the impact?",
    "Tell me about a time you had competing deadlines. How did you decide what to do first?",
    "What would you do if you found a serious quality issue just before delivery?",
    "Describe feedback that changed how you work. What did you do differently afterward?",
    "How have you handled disagreement about the best way to solve a problem?",
    "Which experience would you draw on to succeed in this role, and what would you need to learn?",
  ];
  return prompts.find(prompt => !previous.includes(prompt)) ?? prompts[previous.length % prompts.length];
}

export function localAssessment(answer: string): Assessment {
  const detailed = answer.trim().split(/\s+/u).length >= 30;
  const ownership = /\b(?:I|my)\b/iu.test(answer);
  const outcome = /\b(?:result(?:ed)?|outcome|measured|improved|reduced|increased|saved|learned)\b/iu.test(answer) || /\d/u.test(answer);
  const improvement = !detailed
    ? "Give one specific example. Describe the situation, what you did, and what happened."
    : !ownership
      ? "Make your own contribution explicit. Explain what you decided or did."
      : !outcome
        ? "Finish with the result and how you measured it, or explain what you learned."
        : "Connect your example directly to the question and explain why the result mattered.";
  const score = Math.round(100 * [detailed, ownership, outcome].filter(Boolean).length / 3);
  return {
    method: "checklist", score,
    feedback: "This checklist looks for detail, personal contribution, and an outcome. Review technical accuracy separately.",
    improvement,
    dimensions: { accuracy: 0, relevance: 0, clarity: 0, structure: detailed ? 100 : 0, communication: ownership ? 100 : 0, evidence: outcome ? 100 : 0 },
  };
}
