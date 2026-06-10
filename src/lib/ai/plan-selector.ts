import { chatCompletionJson } from "@/lib/ai/provider";
import { prisma } from "@/lib/prisma";

type PlanSelectionResult = {
  selectedPlanId: string;
  reasoning: string;
};

export async function selectBestPlan(params: {
  objectiveId: string;
  planIds: string[];
  model?: string;
}) {
  const objective = await prisma.objective.findUnique({
    where: { id: params.objectiveId },
    include: {
      plans: {
        where: { id: { in: params.planIds } },
      },
    },
  });

  if (!objective) {
    throw new Error("Objective not found");
  }

  if (objective.plans.length === 0) {
    throw new Error("No plans to select from");
  }

  if (objective.plans.length === 1) {
    return {
      selectedPlanId: objective.plans[0].id,
      reasoning: "Only one plan available.",
    };
  }

  const planList = objective.plans
    .map(
      (p) =>
        `ID: ${p.id}\nTitle: ${p.title}\nDescription: ${p.description}\nApproach: ${p.approach}`
    )
    .join("\n\n");

  const result = await chatCompletionJson<PlanSelectionResult>(
    [
      {
        role: "system",
        content:
          "You select the single best implementation plan for an objective. Return JSON with selectedPlanId (must match one of the provided IDs exactly) and reasoning (2-3 sentences).",
      },
      {
        role: "user",
        content: `Objective: ${objective.title}\n${objective.description}\n\nPlans:\n${planList}`,
      },
    ]
  );

  const valid = objective.plans.find((p) => p.id === result.selectedPlanId);
  if (!valid) {
    return {
      selectedPlanId: objective.plans[0].id,
      reasoning: result.reasoning || "Fallback to first plan.",
    };
  }

  return result;
}
