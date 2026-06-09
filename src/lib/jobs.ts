import { tasks } from "@trigger.dev/sdk";
import type {
  GitHubWebhookPayload,
  IndexEntityPayload,
} from "@/trigger/jobs";
import {
  githubWebhookTask,
  indexEntityTask,
  reindexRepositoryTask,
  runIndexEntity,
  syncRepositoryTask,
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
  handlePushWebhook,
} from "@/lib/github";

function useTrigger() {
  return Boolean(process.env.TRIGGER_SECRET_KEY);
}

export async function enqueueIndexEntity(payload: IndexEntityPayload) {
  if (useTrigger()) {
    return tasks.trigger<typeof indexEntityTask>("index-entity", payload);
  }

  await runIndexEntity(payload);
  return null;
}

export async function enqueueSyncRepository(
  repositoryId: string,
  options?: { indexCommits?: boolean; commitLimit?: number }
) {
  if (useTrigger()) {
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
  if (useTrigger()) {
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
  }

  return null;
}

export async function enqueueReindexRepository(repositoryId: string) {
  if (useTrigger()) {
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
