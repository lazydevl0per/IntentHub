import { chatCompletionJson } from "@/lib/ai/provider";
import { prisma } from "@/lib/prisma";

type DecisionRecommendation = {
  selectedPlanId: string;
  rationale: string;
};

export async function recommendDecision(params: {
  objectiveId: string;
  model?: string;
}) {
  const objective = await prisma.objective.findUnique({
    where: { id: params.objectiveId },
    include: {
      plans: true,
      agentRuns: true,
      evaluations: true,
    },
  });

  if (!objective) {
    throw new Error("Objective not found");
  }

  const context = [
    `Title: ${objective.title}`,
    objective.description,
    "",
    "Plans:",
    ...objective.plans.map(
      (p) =>
        `ID: ${p.id} | ${p.title} (${p.status}): ${p.description}. Approach: ${p.approach}`
    ),
    "",
    "Agent Runs:",
    ...objective.agentRuns.map(
      (r) =>
        `- ${r.agentName} (${r.status}, plan: ${r.planId ?? "none"}): ${r.output.slice(0, 500)}`
    ),
    "",
    "Evaluations:",
    ...objective.evaluations.map(
      (e) => `- ${e.type}: score ${e.score}. ${e.summary}`
    ),
  ].join("\n");

  const result = await chatCompletionJson<DecisionRecommendation>(
    [
      {
        role: "system",
        content:
          "You recommend which implementation plan should win for a software objective. Return JSON with selectedPlanId (must match a provided plan ID) and rationale (3-5 sentences explaining tradeoffs and why this plan wins).",
      },
      {
        role: "user",
        content: context,
      },
    ]
  );

  const valid = objective.plans.find((p) => p.id === result.selectedPlanId);
  if (!valid) {
    const fallback = objective.plans[0];
    if (!fallback) {
      throw new Error("No plans available for recommendation");
    }
    return {
      selectedPlanId: fallback.id,
      rationale: result.rationale || "Recommended based on available evidence.",
    };
  }

  return result;
}
