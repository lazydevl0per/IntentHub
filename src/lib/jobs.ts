import { tasks } from "@trigger.dev/sdk";
import type {
  GitHubWebhookPayload,
  IndexEntityPayload,
} from "@/trigger/jobs";
import {
  analyzeCommitTask,
  executeAgentRunTask,
  generateObjectiveSummaryTask,
  githubWebhookTask,
  indexEntityTask,
  reindexRepositoryTask,
  runIndexEntity,
  runObjectiveWorkflowStepTask,
  syncRepositoryTask,
  type ObjectiveWorkflowStepPayload,
} from "@/trigger/jobs";
import { syncRepository } from "@/lib/github";
import {
  indexCommit,
  indexDecision,
  indexEvaluation,
  indexAgentRun,
  indexObjective,
  indexPlan,
} from "@/lib/indexing";
import { prisma } from "@/lib/prisma";
import {
  handleBranchCreateWebhook,
  handleBranchDeleteWebhook,
  handleCheckRunWebhook,
  handlePullRequestWebhook,
  handlePushWebhook,
} from "@/lib/github";
import { isAiConfigured } from "@/lib/ai/provider";

function isTriggerConfigured() {
  return Boolean(process.env.TRIGGER_SECRET_KEY);
}

export async function enqueueIndexEntity(payload: IndexEntityPayload) {
  if (isTriggerConfigured()) {
    const handle = await tasks.trigger<typeof indexEntityTask>(
      "index-entity",
      payload
    );

    if (payload.entity === "commit") {
      await tasks.trigger<typeof analyzeCommitTask>("analyze-commit", {
        repositoryId: payload.repositoryId,
        sha: payload.sha,
      });
    }

    return handle;
  }

  await runIndexEntity(payload);

  if (payload.entity === "commit") {
    await runAnalyzeCommit(payload.repositoryId, payload.sha);
  }

  return null;
}

async function runAnalyzeCommit(repositoryId: string, sha: string) {
  if (!isAiConfigured()) {
    return;
  }

  try {
    const { generateCommitInsight } = await import("@/lib/ai/commit-insights");
    await generateCommitInsight(repositoryId, sha);
  } catch (error) {
    console.error("[insight] commit analysis failed", {
      repositoryId,
      sha,
      error: error instanceof Error ? error.message : error,
    });
  }
}

export async function enqueueGenerateObjectiveSummary(objectiveId: string) {
  if (isTriggerConfigured()) {
    return tasks.trigger<typeof generateObjectiveSummaryTask>(
      "generate-objective-summary",
      { objectiveId }
    );
  }

  if (!isAiConfigured()) {
    return null;
  }

  try {
    const { generateObjectiveSummary } = await import("@/lib/ai/summaries");
    await generateObjectiveSummary(objectiveId);
  } catch (error) {
    console.error("[summary] objective summary failed", {
      objectiveId,
      error: error instanceof Error ? error.message : error,
    });
  }

  return null;
}

export async function enqueueAnalyzeCommit(
  repositoryId: string,
  sha: string
) {
  if (isTriggerConfigured()) {
    return tasks.trigger<typeof analyzeCommitTask>("analyze-commit", {
      repositoryId,
      sha,
    });
  }

  await runAnalyzeCommit(repositoryId, sha);
  return null;
}

export async function enqueueSyncRepository(
  repositoryId: string,
  options?: { indexCommits?: boolean; commitLimit?: number }
) {
  if (isTriggerConfigured()) {
    return tasks.trigger<typeof syncRepositoryTask>("sync-repository", {
      repositoryId,
      indexCommits: options?.indexCommits,
      commitLimit: options?.commitLimit,
    });
  }

  await syncRepository(repositoryId);

  if (options?.indexCommits === false) {
    return null;
  }

  const limit = options?.commitLimit ?? 20;
  const commits = await prisma.gitCommit.findMany({
    where: { repositoryId },
    take: limit,
    orderBy: { committedAt: "desc" },
  });

  for (const commit of commits) {
    try {
      await indexCommit(repositoryId, commit.sha);
    } catch (error) {
      console.error("[index] commit indexing failed", {
        repositoryId,
        sha: commit.sha,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  return null;
}

export async function enqueueGitHubWebhook(payload: GitHubWebhookPayload) {
  if (isTriggerConfigured()) {
    return tasks.trigger<typeof githubWebhookTask>("github-webhook", payload);
  }

  if (payload.event === "push" && payload.ref && payload.commits) {
    await handlePushWebhook(payload.repositoryId, {
      ref: payload.ref,
      commits: payload.commits,
    });

    for (const commit of payload.commits) {
      try {
        await indexCommit(payload.repositoryId, commit.id);
      } catch (error) {
        console.error("[index] webhook commit indexing failed", {
          repositoryId: payload.repositoryId,
          sha: commit.id,
          error: error instanceof Error ? error.message : error,
        });
      }
    }
  } else if (payload.event === "create" && payload.ref && payload.refType) {
    await handleBranchCreateWebhook(payload.repositoryId, {
      ref: payload.ref,
      ref_type: payload.refType,
    });
  } else if (payload.event === "delete" && payload.ref && payload.refType) {
    await handleBranchDeleteWebhook(payload.repositoryId, {
      ref: payload.ref,
      ref_type: payload.refType,
    });
  } else if (payload.event === "pull_request" && payload.pullRequest) {
    await handlePullRequestWebhook(
      payload.repositoryId,
      payload.pullRequest
    );
  } else if (payload.event === "check_run" && payload.checkRun) {
    await handleCheckRunWebhook(payload.repositoryId, payload.checkRun);
  }

  return null;
}

export async function enqueueReindexRepository(repositoryId: string) {
  if (isTriggerConfigured()) {
    return tasks.trigger<typeof reindexRepositoryTask>(
      "reindex-repository",
      { repositoryId }
    );
  }

  const repository = await prisma.repository.findUnique({
    where: { id: repositoryId },
    include: {
      objectives: true,
      commits: { orderBy: { committedAt: "desc" }, take: 100 },
    },
  });

  if (!repository) {
    throw new Error("Repository not found");
  }

  for (const objective of repository.objectives) {
    await indexObjective(objective.id);

    const [plans, agentRuns, evaluations, decision] = await Promise.all([
      prisma.plan.findMany({ where: { objectiveId: objective.id } }),
      prisma.agentRun.findMany({ where: { objectiveId: objective.id } }),
      prisma.evaluation.findMany({ where: { objectiveId: objective.id } }),
      prisma.decision.findUnique({ where: { objectiveId: objective.id } }),
    ]);

    for (const plan of plans) {
      await indexPlan(plan.id);
    }

    for (const run of agentRuns) {
      await indexAgentRun(run.id);
    }

    for (const evaluation of evaluations) {
      await indexEvaluation(evaluation.id);
    }

    if (decision) {
      await indexDecision(objective.id);
    }
  }

  for (const commit of repository.commits) {
    await indexCommit(repositoryId, commit.sha);
  }

  return null;
}

export async function enqueueExecuteAgentRun(agentRunId: string) {
  if (isTriggerConfigured()) {
    return tasks.trigger<typeof executeAgentRunTask>("execute-agent-run", {
      agentRunId,
    });
  }

  const { executeAgentRun } = await import("@/lib/ai/agent-executor");
  await executeAgentRun(agentRunId);
  return null;
}

export async function enqueueObjectiveWorkflowStep(
  workflowId: string,
  step: ObjectiveWorkflowStepPayload["step"]
) {
  const payload: ObjectiveWorkflowStepPayload = { workflowId, step };

  if (isTriggerConfigured()) {
    return tasks.trigger<typeof runObjectiveWorkflowStepTask>(
      "run-objective-workflow-step",
      payload
    );
  }

  const { runObjectiveWorkflowStep } = await import(
    "@/lib/ai/objective-workflow"
  );
  await runObjectiveWorkflowStep(workflowId, step);
  return null;
}
