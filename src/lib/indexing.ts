import { indexEntityContent } from "@/lib/ai/rag";
import { prisma } from "@/lib/prisma";
import { DocumentEntityType } from "@prisma/client";

export async function indexObjective(objectiveId: string) {
  const objective = await prisma.objective.findUnique({
    where: { id: objectiveId },
  });

  if (!objective) return;

  await indexEntityContent({
    repositoryId: objective.repositoryId,
    entityType: DocumentEntityType.OBJECTIVE,
    entityId: objective.id,
    content: `${objective.title}\n${objective.description}`,
  });
}

export async function indexPlan(planId: string) {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: { objective: true },
  });

  if (!plan) return;

  await indexEntityContent({
    repositoryId: plan.objective.repositoryId,
    entityType: DocumentEntityType.PLAN,
    entityId: plan.id,
    content: `${plan.title}\n${plan.description}\n${plan.approach}`,
  });
}

export async function indexDecision(objectiveId: string) {
  const decision = await prisma.decision.findUnique({
    where: { objectiveId },
    include: {
      objective: true,
      selectedPlan: true,
    },
  });

  if (!decision) return;

  await indexEntityContent({
    repositoryId: decision.objective.repositoryId,
    entityType: DocumentEntityType.DECISION,
    entityId: decision.id,
    content: `Decision for ${decision.objective.title}. Selected plan: ${decision.selectedPlan.title}. Rationale: ${decision.rationale}`,
  });
}

export async function indexEvaluation(evaluationId: string) {
  const evaluation = await prisma.evaluation.findUnique({
    where: { id: evaluationId },
    include: { objective: true },
  });

  if (!evaluation) return;

  await indexEntityContent({
    repositoryId: evaluation.objective.repositoryId,
    entityType: DocumentEntityType.EVALUATION,
    entityId: evaluation.id,
    content: `${evaluation.type} evaluation. Score: ${evaluation.score}. ${evaluation.summary}`,
  });
}

export async function indexAgentRun(agentRunId: string) {
  const agentRun = await prisma.agentRun.findUnique({
    where: { id: agentRunId },
    include: { objective: true },
  });

  if (!agentRun) return;

  await indexEntityContent({
    repositoryId: agentRun.objective.repositoryId,
    entityType: DocumentEntityType.AGENT_RUN,
    entityId: agentRun.id,
    content: `Agent: ${agentRun.agentName}. Model: ${agentRun.model ?? "unknown"}. Prompt: ${agentRun.prompt}. Output: ${agentRun.output}`,
  });
}

export async function indexCommit(repositoryId: string, sha: string) {
  const commit = await prisma.gitCommit.findUnique({
    where: {
      repositoryId_sha: {
        repositoryId,
        sha,
      },
    },
  });

  if (!commit) return;

  await indexEntityContent({
    repositoryId,
    entityType: DocumentEntityType.COMMIT,
    entityId: commit.id,
    content: `Commit ${commit.sha} by ${commit.author}: ${commit.message}`,
  });
}
