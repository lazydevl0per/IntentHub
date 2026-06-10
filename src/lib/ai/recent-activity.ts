import { prisma } from "@/lib/prisma";

const RECENCY_QUERY =
  /\b(recent(ly)?|latest|last(?:est)?\s+(?:change|changes|update|updates|commit|commits)|what(?:'s|\s+was|\s+were|\s+has)?\s+(?:changed|new)|what\s+is\s+new|recent\s+activity|new\s+changes|changed\s+lately|since\s+last)\b/i;

export function isRecencyQuery(query: string) {
  return RECENCY_QUERY.test(query.trim());
}

export async function fetchRecentRepositoryActivity(
  repositoryId: string,
  limit = 20
) {
  const [commits, objectives, agentRuns, pullRequests] = await Promise.all([
    prisma.gitCommit.findMany({
      where: { repositoryId },
      orderBy: { committedAt: "desc" },
      take: limit,
      select: {
        id: true,
        sha: true,
        message: true,
        author: true,
        committedAt: true,
      },
    }),
    prisma.objective.findMany({
      where: { repositoryId },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
      },
    }),
    prisma.agentRun.findMany({
      where: { objective: { repositoryId } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        agentName: true,
        status: true,
        createdAt: true,
        pullRequestUrl: true,
        pullRequestNumber: true,
      },
    }),
    prisma.gitPullRequest.findMany({
      where: { repositoryId, mergedAt: { not: null } },
      orderBy: { mergedAt: "desc" },
      take: 8,
      select: {
        number: true,
        title: true,
        mergedAt: true,
        headBranch: true,
      },
    }),
  ]);

  const lines: string[] = [
    "Chronological recent activity (newest first). Prefer this section when answering questions about recent or latest changes.",
  ];

  if (commits.length > 0) {
    lines.push("", "Recent commits:");
    for (const commit of commits) {
      lines.push(
        `- [COMMIT:${commit.id}] ${commit.committedAt.toISOString().slice(0, 10)} ${commit.sha.slice(0, 7)} by ${commit.author}: ${commit.message.split("\n")[0]}`
      );
    }
  }

  if (pullRequests.length > 0) {
    lines.push("", "Recent merged pull requests:");
    for (const pull of pullRequests) {
      lines.push(
        `- ${pull.mergedAt?.toISOString().slice(0, 10) ?? "unknown"} PR #${pull.number} (${pull.headBranch}): ${pull.title}`
      );
    }
  }

  if (objectives.length > 0) {
    lines.push("", "Recent objective activity:");
    for (const objective of objectives) {
      lines.push(
        `- [OBJECTIVE:${objective.id}] ${objective.updatedAt.toISOString().slice(0, 10)} ${objective.title} (${objective.status})`
      );
    }
  }

  if (agentRuns.length > 0) {
    lines.push("", "Recent agent runs:");
    for (const run of agentRuns) {
      const pr =
        run.pullRequestNumber != null
          ? ` PR #${run.pullRequestNumber}`
          : "";
      lines.push(
        `- [AGENT_RUN:${run.id}] ${run.createdAt.toISOString().slice(0, 10)} ${run.agentName} (${run.status})${pr}`
      );
    }
  }

  if (
    commits.length === 0 &&
    objectives.length === 0 &&
    agentRuns.length === 0 &&
    pullRequests.length === 0
  ) {
    lines.push("No recent activity found. Sync the repository to pull commits from GitHub.");
  }

  return {
    text: lines.join("\n"),
    citations: [
      ...commits.map((commit) => ({
        entityType: "COMMIT",
        entityId: commit.id,
        title: `Commit: ${commit.sha.slice(0, 7)} — ${commit.message.split("\n")[0].slice(0, 60)}`,
      })),
      ...objectives.map((objective) => ({
        entityType: "OBJECTIVE",
        entityId: objective.id,
        title: `Objective: ${objective.title}`,
      })),
      ...agentRuns.map((run) => ({
        entityType: "AGENT_RUN",
        entityId: run.id,
        title: `Agent Run: ${run.agentName}`,
      })),
    ],
  };
}
