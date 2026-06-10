import { enqueueGenerateObjectiveSummary, enqueueIndexEntity } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";

export async function recordDecision(params: {
  objectiveId: string;
  selectedPlanId: string;
  rationale: string;
  linkedCommitSha?: string;
  approvedById: string;
}) {
  const plan = await prisma.plan.findFirst({
    where: {
      id: params.selectedPlanId,
      objectiveId: params.objectiveId,
    },
  });

  if (!plan) {
    throw new Error("Selected plan does not belong to this objective");
  }

  const decision = await prisma.decision.upsert({
    where: { objectiveId: params.objectiveId },
    create: {
      objectiveId: params.objectiveId,
      selectedPlanId: params.selectedPlanId,
      rationale: params.rationale,
      linkedCommitSha: params.linkedCommitSha,
      approvedById: params.approvedById,
    },
    update: {
      selectedPlanId: params.selectedPlanId,
      rationale: params.rationale,
      linkedCommitSha: params.linkedCommitSha,
      approvedById: params.approvedById,
      approvedAt: new Date(),
    },
    include: {
      selectedPlan: true,
      approvedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  await prisma.objective.update({
    where: { id: params.objectiveId },
    data: { status: "COMPLETED" },
  });

  await prisma.plan.update({
    where: { id: params.selectedPlanId },
    data: { status: "SELECTED" },
  });

  await prisma.plan.updateMany({
    where: {
      objectiveId: params.objectiveId,
      id: { not: params.selectedPlanId },
    },
    data: { status: "REJECTED" },
  });

  try {
    await enqueueIndexEntity({
      entity: "decision",
      objectiveId: params.objectiveId,
    });
  } catch (error) {
    console.error("[index] decision indexing enqueue failed", {
      objectiveId: params.objectiveId,
      error: error instanceof Error ? error.message : error,
    });
  }

  try {
    await enqueueGenerateObjectiveSummary(params.objectiveId);
  } catch (error) {
    console.error("[summary] objective summary enqueue failed", {
      objectiveId: params.objectiveId,
      error: error instanceof Error ? error.message : error,
    });
  }

  return decision;
}
