import { chatCompletionJson } from "@/lib/ai/provider";
import { indexObjective } from "@/lib/indexing";
import { prisma } from "@/lib/prisma";

type SummaryResult = {
  businessSummary: string;
  technicalSummary: string;
  risks: string;
  architectureImpact: string;
};

export async function generateObjectiveSummary(objectiveId: string) {
  const objective = await prisma.objective.findUnique({
    where: { id: objectiveId },
    include: {
      plans: true,
      agentRuns: true,
      evaluations: true,
      decision: {
        include: { selectedPlan: true },
      },
    },
  });

  if (!objective) {
    throw new Error("Objective not found");
  }

  const context = [
    `Title: ${objective.title}`,
    `Description: ${objective.description}`,
    "",
    "Plans:",
    ...objective.plans.map(
      (p) =>
        `- ${p.title} (${p.status}): ${p.description}. Approach: ${p.approach}`
    ),
    "",
    "Agent Runs:",
    ...objective.agentRuns.map(
      (r) =>
        `- ${r.agentName} (${r.status}): ${r.prompt.slice(0, 200)}... Output: ${r.output.slice(0, 300)}`
    ),
    "",
    "Evaluations:",
    ...objective.evaluations.map(
      (e) => `- ${e.type}: score ${e.score}. ${e.summary}`
    ),
    objective.decision
      ? `\nDecision: Selected plan "${objective.decision.selectedPlan.title}". Rationale: ${objective.decision.rationale}`
      : "",
  ].join("\n");

  const result = await chatCompletionJson<SummaryResult>([
    {
      role: "system",
      content:
        "You summarize completed software objectives for a knowledge base. Return JSON with keys: businessSummary, technicalSummary, risks, architectureImpact. Each value is 2-4 sentences.",
    },
    {
      role: "user",
      content: context,
    },
  ]);

  const updated = await prisma.objective.update({
    where: { id: objectiveId },
    data: {
      businessSummary: result.businessSummary,
      technicalSummary: result.technicalSummary,
      risks: result.risks,
      architectureImpact: result.architectureImpact,
    },
  });

  await indexObjective(objectiveId);

  return updated;
}
