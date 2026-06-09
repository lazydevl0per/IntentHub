import { task } from "@trigger.dev/sdk";
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

export type IndexEntityPayload =
  | { entity: "objective"; id: string }
  | { entity: "plan"; id: string }
  | { entity: "decision"; objectiveId: string }
  | { entity: "evaluation"; id: string }
  | { entity: "agent-run"; id: string }
  | { entity: "commit"; repositoryId: string; sha: string };

export async function runIndexEntity(payload: IndexEntityPayload) {
  switch (payload.entity) {
    case "objective":
      await indexObjective(payload.id);
      break;
    case "plan":
      await indexPlan(payload.id);
      break;
    case "decision":
      await indexDecision(payload.objectiveId);
      break;
    case "evaluation":
      await indexEvaluation(payload.id);
      break;
    case "agent-run":
      await indexAgentRun(payload.id);
      break;
    case "commit":
      await indexCommit(payload.repositoryId, payload.sha);
      break;
  }
}

export const indexEntityTask = task({
  id: "index-entity",
  run: async (payload: IndexEntityPayload) => {
    await runIndexEntity(payload);
    return { indexed: payload.entity };
  },
});

export const syncRepositoryTask = task({
  id: "sync-repository",
  run: async (payload: {
    repositoryId: string;
    indexCommits?: boolean;
    commitLimit?: number;
  }) => {
    await syncRepository(payload.repositoryId);

    if (payload.indexCommits === false) {
      return { synced: true, indexedCommits: 0 };
    }

    const limit = payload.commitLimit ?? 20;
    const commits = await prisma.gitCommit.findMany({
      where: { repositoryId: payload.repositoryId },
      take: limit,
      orderBy: { committedAt: "desc" },
    });

    const errors: string[] = [];

    for (const commit of commits) {
      try {
        await indexCommit(payload.repositoryId, commit.sha);
        if (process.env.OPENAI_API_KEY) {
          const { generateCommitInsight } = await import(
            "@/lib/ai/commit-insights"
          );
          await generateCommitInsight(payload.repositoryId, commit.sha);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Index failed";
        errors.push(`${commit.sha.slice(0, 7)}: ${message}`);
      }
    }

    return {
      synced: true,
      indexedCommits: commits.length - errors.length,
      indexErrors: errors.length > 0 ? errors : undefined,
    };
  },
});

export type GitHubWebhookPayload = {
  repositoryId: string;
  event: "push" | "create" | "delete";
  ref?: string;
  refType?: string;
  commits?: Array<{
    id: string;
    message: string;
    author: { name: string };
    timestamp: string;
  }>;
};

export const githubWebhookTask = task({
  id: "github-webhook",
  run: async (payload: GitHubWebhookPayload) => {
    const {
      handleBranchCreateWebhook,
      handleBranchDeleteWebhook,
      handlePushWebhook,
    } = await import("@/lib/github");

    if (payload.event === "push" && payload.ref && payload.commits) {
      await handlePushWebhook(payload.repositoryId, {
        ref: payload.ref,
        commits: payload.commits,
      });

      const errors: string[] = [];

      for (const commit of payload.commits) {
        try {
          await indexCommit(payload.repositoryId, commit.id);
          if (process.env.OPENAI_API_KEY) {
            const { generateCommitInsight } = await import(
              "@/lib/ai/commit-insights"
            );
            await generateCommitInsight(payload.repositoryId, commit.id);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Index failed";
          errors.push(`${commit.id.slice(0, 7)}: ${message}`);
        }
      }

      return {
        event: payload.event,
        commits: payload.commits.length,
        indexErrors: errors.length > 0 ? errors : undefined,
      };
    }

    if (payload.event === "create" && payload.ref && payload.refType) {
      await handleBranchCreateWebhook(payload.repositoryId, {
        ref: payload.ref,
        ref_type: payload.refType,
      });
    }

    if (payload.event === "delete" && payload.ref && payload.refType) {
      await handleBranchDeleteWebhook(payload.repositoryId, {
        ref: payload.ref,
        ref_type: payload.refType,
      });
    }

    return { event: payload.event };
  },
});

export const reindexRepositoryTask = task({
  id: "reindex-repository",
  run: async (payload: { repositoryId: string }) => {
    const repository = await prisma.repository.findUnique({
      where: { id: payload.repositoryId },
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
      await indexCommit(payload.repositoryId, commit.sha);
    }

    return {
      objectives: repository.objectives.length,
      commits: repository.commits.length,
    };
  },
});

export const generateObjectiveSummaryTask = task({
  id: "generate-objective-summary",
  run: async (payload: { objectiveId: string }) => {
    const { generateObjectiveSummary } = await import("@/lib/ai/summaries");
    const objective = await generateObjectiveSummary(payload.objectiveId);
    return { objectiveId: objective.id };
  },
});

export const analyzeCommitTask = task({
  id: "analyze-commit",
  run: async (payload: { repositoryId: string; sha: string }) => {
    const { generateCommitInsight } = await import("@/lib/ai/commit-insights");
    const insight = await generateCommitInsight(
      payload.repositoryId,
      payload.sha
    );
    return { sha: insight.sha };
  },
});

export const executeAgentRunTask = task({
  id: "execute-agent-run",
  run: async (payload: { agentRunId: string }) => {
    const { executeAgentRun } = await import("@/lib/ai/agent-executor");
    const run = await executeAgentRun(payload.agentRunId);
    return { agentRunId: run.id, status: run.status };
  },
});
