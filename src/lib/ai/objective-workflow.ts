import {
  buildAgentBranchName,
  buildAgentPrompt,
} from "@/lib/ai/agent-executor";
import { recommendDecision } from "@/lib/ai/decision-recommender";
import { generateAgentRunEvaluation } from "@/lib/ai/evaluation-generator";
import { generatePlansForObjective } from "@/lib/ai/plan-generator";
import { selectBestPlan } from "@/lib/ai/plan-selector";
import {
  recordDecision,
  resolveLinkedCommitForObjective,
} from "@/lib/decision";
import { syncObjectiveDecisionCommit } from "@/lib/github";
import { enqueueExecuteAgentRun, enqueueIndexEntity } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";
import { WorkflowStatus } from "@prisma/client";

export type WorkflowStep =
  | "generate-plans"
  | "continue-after-plan-approval"
  | "continue-after-agent-complete";

const TERMINAL_STATUSES: WorkflowStatus[] = [
  "COMPLETED",
  "FAILED",
  "CANCELLED",
];

export function isTerminalWorkflowStatus(status: WorkflowStatus) {
  return TERMINAL_STATUSES.includes(status);
}

async function failWorkflow(workflowId: string, message: string) {
  await prisma.objectiveWorkflow.update({
    where: { id: workflowId },
    data: {
      status: "FAILED",
      errorMessage: message,
    },
  });
}

export async function startObjectiveWorkflow(params: {
  objectiveId: string;
  userId: string;
  model: string;
}) {
  const existing = await prisma.objectiveWorkflow.findUnique({
    where: { objectiveId: params.objectiveId },
  });

  if (
    existing &&
    !isTerminalWorkflowStatus(existing.status)
  ) {
    throw new Error("A workflow is already in progress for this objective");
  }

  const objective = await prisma.objective.findUnique({
    where: { id: params.objectiveId },
  });

  if (!objective) {
    throw new Error("Objective not found");
  }

  if (objective.status === "COMPLETED") {
    throw new Error("Objective is already completed");
  }

  if (existing) {
    await prisma.objectiveWorkflow.update({
      where: { id: existing.id },
      data: {
        status: "GENERATING_PLANS",
        model: params.model,
        selectedPlanId: null,
        agentRunId: null,
        recommendedPlanId: null,
        recommendedRationale: null,
        errorMessage: null,
        createdById: params.userId,
      },
    });
    return existing.id;
  }

  const workflow = await prisma.objectiveWorkflow.create({
    data: {
      objectiveId: params.objectiveId,
      model: params.model,
      createdById: params.userId,
      status: "GENERATING_PLANS",
    },
  });

  return workflow.id;
}

export async function generateWorkflowPlans(workflowId: string) {
  const workflow = await prisma.objectiveWorkflow.findUnique({
    where: { id: workflowId },
    include: { objective: true },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  try {
    const generated = await generatePlansForObjective({
      objectiveId: workflow.objectiveId,
      userId: workflow.createdById,
      model: workflow.model,
    });

    for (const plan of generated) {
      const created = await prisma.plan.create({
        data: {
          objectiveId: workflow.objectiveId,
          title: plan.title,
          description: plan.description,
          approach: plan.approach,
          status: "DRAFT",
          createdById: workflow.createdById,
        },
      });

      try {
        await enqueueIndexEntity({ entity: "plan", id: created.id });
      } catch (error) {
        console.error("[index] plan indexing enqueue failed", {
          planId: created.id,
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    await prisma.objectiveWorkflow.update({
      where: { id: workflowId },
      data: { status: "AWAITING_PLAN_APPROVAL" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Plan generation failed";
    await failWorkflow(workflowId, message);
    throw error;
  }
}

export async function continueAfterPlanApproval(workflowId: string) {
  const workflow = await prisma.objectiveWorkflow.findUnique({
    where: { id: workflowId },
    include: {
      objective: { include: { repository: true, plans: true } },
    },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  if (workflow.status !== "AWAITING_PLAN_APPROVAL") {
    throw new Error("Workflow is not awaiting plan approval");
  }

  const planIds = workflow.objective.plans.map((p) => p.id);
  if (planIds.length === 0) {
    await failWorkflow(workflowId, "No plans available to execute");
    throw new Error("No plans available to execute");
  }

  try {
    const selection = await selectBestPlan({
      objectiveId: workflow.objectiveId,
      planIds,
      model: workflow.model,
    });

    const plan = workflow.objective.plans.find(
      (p) => p.id === selection.selectedPlanId
    );

    if (!plan) {
      await failWorkflow(workflowId, "Selected plan not found");
      throw new Error("Selected plan not found");
    }

    const branchName = buildAgentBranchName(plan.title);
    const prompt = buildAgentPrompt({
      objectiveTitle: workflow.objective.title,
      objectiveDescription: workflow.objective.description,
      planTitle: plan.title,
      planDescription: plan.description,
      planApproach: plan.approach,
      repositoryFullName: workflow.objective.repository.fullName,
      branchName,
    });

    const agentRun = await prisma.agentRun.create({
      data: {
        objectiveId: workflow.objectiveId,
        planId: plan.id,
        agentName: "IntentHub Workflow Agent",
        model: workflow.model,
        prompt,
        output: "",
        branchName,
        status: "PENDING",
        createdById: workflow.createdById,
      },
    });

    await prisma.objectiveWorkflow.update({
      where: { id: workflowId },
      data: {
        status: "RUNNING_AGENT",
        selectedPlanId: plan.id,
        agentRunId: agentRun.id,
      },
    });

    await enqueueExecuteAgentRun(agentRun.id);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Agent execution failed to start";
    await failWorkflow(workflowId, message);
    throw error;
  }
}

async function waitForCiEvaluation(agentRunId: string, maxMs = 120_000) {
  const intervalMs = 5_000;
  const deadline = Date.now() + maxMs;

  while (Date.now() < deadline) {
    const evaluation = await prisma.evaluation.findFirst({
      where: { agentRunId },
    });
    if (evaluation) return evaluation;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return null;
}

export async function continueAfterAgentComplete(workflowId: string) {
  const workflow = await prisma.objectiveWorkflow.findUnique({
    where: { id: workflowId },
    include: { objective: true },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  if (!workflow.agentRunId) {
    await failWorkflow(workflowId, "No agent run linked to workflow");
    throw new Error("No agent run linked to workflow");
  }

  const agentRun = await prisma.agentRun.findUnique({
    where: { id: workflow.agentRunId },
  });

  if (!agentRun) {
    await failWorkflow(workflowId, "Agent run not found");
    throw new Error("Agent run not found");
  }

  if (agentRun.status === "FAILED") {
    await failWorkflow(
      workflowId,
      agentRun.errorMessage ?? "Agent run failed"
    );
    return;
  }

  if (agentRun.status !== "COMPLETED") {
    return;
  }

  await prisma.objectiveWorkflow.update({
    where: { id: workflowId },
    data: { status: "EVALUATING" },
  });

  try {
    await waitForCiEvaluation(workflow.agentRunId);

    const existingEval = await prisma.evaluation.findFirst({
      where: { agentRunId: workflow.agentRunId },
    });

    if (!existingEval) {
      const generated = await generateAgentRunEvaluation({
        agentRunId: workflow.agentRunId,
        model: workflow.model,
      });

      const evaluation = await prisma.evaluation.create({
        data: {
          objectiveId: workflow.objectiveId,
          planId: agentRun.planId,
          agentRunId: workflow.agentRunId,
          type: generated.type,
          score: generated.score,
          summary: generated.summary,
          createdById: workflow.createdById,
        },
      });

      try {
        await enqueueIndexEntity({ entity: "evaluation", id: evaluation.id });
      } catch (error) {
        console.error("[index] evaluation indexing enqueue failed", {
          evaluationId: evaluation.id,
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    const recommendation = await recommendDecision({
      objectiveId: workflow.objectiveId,
      model: workflow.model,
    });

    await prisma.objectiveWorkflow.update({
      where: { id: workflowId },
      data: {
        status: "AWAITING_DECISION_APPROVAL",
        recommendedPlanId: recommendation.selectedPlanId,
        recommendedRationale: recommendation.rationale,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Evaluation or recommendation failed";
    await failWorkflow(workflowId, message);
    throw error;
  }
}

export async function approveWorkflowDecision(params: {
  workflowId: string;
  userId: string;
  selectedPlanId?: string;
  rationale?: string;
  linkedCommitSha?: string;
}) {
  const workflow = await prisma.objectiveWorkflow.findUnique({
    where: { id: params.workflowId },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  if (workflow.status !== "AWAITING_DECISION_APPROVAL") {
    throw new Error("Workflow is not awaiting decision approval");
  }

  const selectedPlanId =
    params.selectedPlanId ?? workflow.recommendedPlanId;
  const rationale =
    params.rationale ?? workflow.recommendedRationale;

  if (!selectedPlanId || !rationale) {
    throw new Error("Missing decision recommendation");
  }

  let linkedCommitSha = params.linkedCommitSha;
  if (!linkedCommitSha) {
    await syncObjectiveDecisionCommit(workflow.objectiveId);
    linkedCommitSha =
      (await resolveLinkedCommitForObjective(workflow.objectiveId)) ?? undefined;
  }

  const decision = await recordDecision({
    objectiveId: workflow.objectiveId,
    selectedPlanId,
    rationale,
    linkedCommitSha,
    approvedById: params.userId,
  });

  await prisma.objectiveWorkflow.update({
    where: { id: params.workflowId },
    data: { status: "COMPLETED" },
  });

  return decision;
}

export async function cancelObjectiveWorkflow(workflowId: string) {
  const workflow = await prisma.objectiveWorkflow.findUnique({
    where: { id: workflowId },
  });

  if (!workflow) {
    throw new Error("Workflow not found");
  }

  if (isTerminalWorkflowStatus(workflow.status)) {
    throw new Error("Workflow is already finished");
  }

  await prisma.objectiveWorkflow.update({
    where: { id: workflowId },
    data: { status: "CANCELLED" },
  });
}

export async function runObjectiveWorkflowStep(
  workflowId: string,
  step: WorkflowStep
) {
  switch (step) {
    case "generate-plans":
      await generateWorkflowPlans(workflowId);
      break;
    case "continue-after-plan-approval":
      await continueAfterPlanApproval(workflowId);
      break;
    case "continue-after-agent-complete":
      await continueAfterAgentComplete(workflowId);
      break;
  }
}

export async function resumeWorkflowForAgentRun(agentRunId: string) {
  const workflow = await prisma.objectiveWorkflow.findFirst({
    where: {
      agentRunId,
      status: "RUNNING_AGENT",
    },
  });

  if (!workflow) return;

  const { enqueueObjectiveWorkflowStep } = await import("@/lib/jobs");
  await enqueueObjectiveWorkflowStep(
    workflow.id,
    "continue-after-agent-complete"
  );
}

export async function getWorkflowResponse(objectiveId: string) {
  const workflow = await prisma.objectiveWorkflow.findUnique({
    where: { objectiveId },
    include: {
      objective: {
        include: {
          plans: { orderBy: { createdAt: "asc" } },
          agentRuns: {
            where: {},
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
      },
    },
  });

  if (!workflow) return null;

  const agentRun = workflow.agentRunId
    ? await prisma.agentRun.findUnique({
        where: { id: workflow.agentRunId },
      })
    : null;

  const recommendedPlan = workflow.recommendedPlanId
    ? await prisma.plan.findUnique({
        where: { id: workflow.recommendedPlanId },
      })
    : null;

  return {
    id: workflow.id,
    objectiveId: workflow.objectiveId,
    status: workflow.status,
    model: workflow.model,
    selectedPlanId: workflow.selectedPlanId,
    agentRunId: workflow.agentRunId,
    recommendedPlanId: workflow.recommendedPlanId,
    recommendedRationale: workflow.recommendedRationale,
    errorMessage: workflow.errorMessage,
    createdAt: workflow.createdAt,
    updatedAt: workflow.updatedAt,
    agentRun,
    recommendedPlan,
    plans: workflow.objective.plans,
  };
}
