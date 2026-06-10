import { prisma } from "@/lib/prisma";

export type IntentContextBlock = {
  label: string;
  text: string;
  citations: Array<{
    entityType: string;
    entityId: string;
    title: string;
  }>;
};

const RECENCY_QUERY =
  /\b(recent(ly)?|latest|last(?:est)?\s+(?:change|changes|update|updates|commit|commits)|what(?:'s|\s+was|\s+were|\s+has)?\s+(?:changed|new)|what\s+is\s+new|recent\s+activity|new\s+changes|changed\s+lately|since\s+last)\b/i;

const REJECTED_QUERY =
  /\b(rejected|alternatives?|other\s+plans?|not\s+chosen|passed\s+over|declined|didn't\s+(?:pick|choose|select))\b/i;

const DECISION_QUERY =
  /\b(why\s+(?:was|were|did)|rationale|what\s+was\s+(?:chosen|selected|decided)|architecture\s+(?:chosen|decision)|how\s+was\s+.*\s+decided|reason\s+for\s+(?:choosing|selecting))\b/i;

const ACTIVE_QUERY =
  /\b(active|in[\s-]progress|still\s+open|ongoing|not\s+(?:completed|done|finished)|open\s+objectives?|which\s+objectives?\s+(?:are|remain))\b/i;

export type ChatIntent = "recency" | "rejected" | "decision" | "active";

export function isRecencyQuery(query: string) {
  return RECENCY_QUERY.test(query.trim());
}

export function detectChatIntents(query: string): ChatIntent[] {
  const trimmed = query.trim();
  const intents: ChatIntent[] = [];

  if (RECENCY_QUERY.test(trimmed)) intents.push("recency");
  if (REJECTED_QUERY.test(trimmed)) intents.push("rejected");
  if (DECISION_QUERY.test(trimmed)) intents.push("decision");
  if (ACTIVE_QUERY.test(trimmed)) intents.push("active");

  return intents;
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
        run.pullRequestNumber != null ? ` PR #${run.pullRequestNumber}` : "";
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
    lines.push(
      "No recent activity found. Sync the repository to pull commits from GitHub."
    );
  }

  return {
    label: "RECENT ACTIVITY",
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
  } satisfies IntentContextBlock;
}

export async function fetchRepoSnapshot(repositoryId: string) {
  const [commitCount, objectiveCount, activeObjectives, latestDecision, recentCommits] =
    await Promise.all([
      prisma.gitCommit.count({ where: { repositoryId } }),
      prisma.objective.count({ where: { repositoryId } }),
      prisma.objective.findMany({
        where: { repositoryId, status: { in: ["DRAFT", "ACTIVE"] } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, title: true, status: true },
      }),
      prisma.decision.findFirst({
        where: { objective: { repositoryId } },
        orderBy: { approvedAt: "desc" },
        include: {
          selectedPlan: { select: { title: true } },
          objective: { select: { id: true, title: true } },
        },
      }),
      prisma.gitCommit.findMany({
        where: { repositoryId },
        orderBy: { committedAt: "desc" },
        take: 5,
        select: { id: true, sha: true, message: true, committedAt: true },
      }),
    ]);

  const lines = [
    "Repository snapshot for grounding.",
    `Indexed commits: ${commitCount}. Objectives: ${objectiveCount}.`,
  ];

  if (activeObjectives.length > 0) {
    lines.push("", "Active objectives:");
    for (const objective of activeObjectives) {
      lines.push(
        `- [OBJECTIVE:${objective.id}] ${objective.title} (${objective.status})`
      );
    }
  }

  if (latestDecision) {
    lines.push(
      "",
      `Latest decision: [DECISION:${latestDecision.id}] objective "${latestDecision.objective.title}" selected plan "${latestDecision.selectedPlan.title}".`
    );
  }

  if (recentCommits.length > 0) {
    lines.push("", "Latest commits:");
    for (const commit of recentCommits) {
      lines.push(
        `- [COMMIT:${commit.id}] ${commit.committedAt.toISOString().slice(0, 10)} ${commit.sha.slice(0, 7)}: ${commit.message.split("\n")[0]}`
      );
    }
  }

  const citations: IntentContextBlock["citations"] = [
    ...activeObjectives.map((objective) => ({
      entityType: "OBJECTIVE",
      entityId: objective.id,
      title: `Objective: ${objective.title}`,
    })),
    ...recentCommits.map((commit) => ({
      entityType: "COMMIT",
      entityId: commit.id,
      title: `Commit: ${commit.sha.slice(0, 7)}`,
    })),
  ];

  if (latestDecision) {
    citations.push({
      entityType: "DECISION",
      entityId: latestDecision.id,
      title: `Decision: ${latestDecision.objective.title}`,
    });
  }

  return {
    label: "REPOSITORY SNAPSHOT",
    text: lines.join("\n"),
    citations,
  } satisfies IntentContextBlock;
}

export async function fetchRejectedPlansContext(repositoryId: string) {
  const rejectedPlans = await prisma.plan.findMany({
    where: {
      status: "REJECTED",
      objective: { repositoryId },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      objective: {
        select: { id: true, title: true },
      },
    },
  });

  const lines = [
    "Rejected plans and alternatives. Prefer this section when answering about rejected options or alternatives not chosen.",
  ];

  if (rejectedPlans.length === 0) {
    lines.push("No rejected plans recorded for this repository.");
  } else {
    for (const plan of rejectedPlans) {
      lines.push(
        "",
        `[PLAN:${plan.id}] Objective: [OBJECTIVE:${plan.objective.id}] ${plan.objective.title}`,
        `Rejected plan: ${plan.title}`,
        plan.description,
        plan.approach
      );
    }
  }

  return {
    label: "REJECTED PLANS",
    text: lines.join("\n"),
    citations: rejectedPlans.flatMap((plan) => [
      {
        entityType: "PLAN",
        entityId: plan.id,
        title: `Plan: ${plan.title}`,
      },
      {
        entityType: "OBJECTIVE",
        entityId: plan.objective.id,
        title: `Objective: ${plan.objective.title}`,
      },
    ]),
  } satisfies IntentContextBlock;
}

export async function fetchDecisionsContext(repositoryId: string) {
  const decisions = await prisma.decision.findMany({
    where: { objective: { repositoryId } },
    orderBy: { approvedAt: "desc" },
    include: {
      objective: {
        select: {
          id: true,
          title: true,
          description: true,
          businessSummary: true,
          technicalSummary: true,
        },
      },
      selectedPlan: {
        select: { id: true, title: true, description: true, approach: true },
      },
    },
  });

  const lines = [
    "Recorded decisions and rationale. Prefer this section when explaining why an approach was chosen.",
  ];

  if (decisions.length === 0) {
    lines.push("No decisions recorded yet.");
  } else {
    for (const decision of decisions) {
      lines.push(
        "",
        `[DECISION:${decision.id}] Objective: [OBJECTIVE:${decision.objective.id}] ${decision.objective.title}`,
        `Selected plan: [PLAN:${decision.selectedPlan.id}] ${decision.selectedPlan.title}`,
        `Rationale: ${decision.rationale}`,
        decision.selectedPlan.approach
      );
      if (decision.linkedCommitSha) {
        lines.push(`Linked commit: ${decision.linkedCommitSha.slice(0, 7)}`);
      }
      if (decision.objective.technicalSummary) {
        lines.push(`Technical summary: ${decision.objective.technicalSummary}`);
      }
    }
  }

  return {
    label: "DECISIONS",
    text: lines.join("\n"),
    citations: decisions.flatMap((decision) => [
      {
        entityType: "DECISION",
        entityId: decision.id,
        title: `Decision: ${decision.objective.title}`,
      },
      {
        entityType: "OBJECTIVE",
        entityId: decision.objective.id,
        title: `Objective: ${decision.objective.title}`,
      },
      {
        entityType: "PLAN",
        entityId: decision.selectedPlan.id,
        title: `Plan: ${decision.selectedPlan.title}`,
      },
    ]),
  } satisfies IntentContextBlock;
}

export async function fetchActiveObjectivesContext(repositoryId: string) {
  const objectives = await prisma.objective.findMany({
    where: {
      repositoryId,
      status: { in: ["DRAFT", "ACTIVE"] },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      plans: { select: { id: true, title: true, status: true } },
      _count: { select: { agentRuns: true, evaluations: true } },
    },
  });

  const lines = [
    "Active and in-progress objectives. Prefer this section when answering about open or ongoing work.",
  ];

  if (objectives.length === 0) {
    lines.push("No active objectives. All objectives may be completed or archived.");
  } else {
    for (const objective of objectives) {
      lines.push(
        "",
        `[OBJECTIVE:${objective.id}] ${objective.title} (${objective.status})`,
        objective.description,
        `Plans: ${objective.plans.length}. Agent runs: ${objective._count.agentRuns}. Evaluations: ${objective._count.evaluations}.`
      );
    }
  }

  return {
    label: "ACTIVE OBJECTIVES",
    text: lines.join("\n"),
    citations: objectives.map((objective) => ({
      entityType: "OBJECTIVE",
      entityId: objective.id,
      title: `Objective: ${objective.title}`,
    })),
  } satisfies IntentContextBlock;
}

export async function fetchIntentContextBlocks(
  repositoryId: string,
  intents: ChatIntent[]
) {
  const blocks: IntentContextBlock[] = [];
  const tasks: Promise<IntentContextBlock>[] = [fetchRepoSnapshot(repositoryId)];

  if (intents.includes("recency")) {
    tasks.push(fetchRecentRepositoryActivity(repositoryId));
  }
  if (intents.includes("rejected")) {
    tasks.push(fetchRejectedPlansContext(repositoryId));
  }
  if (intents.includes("decision")) {
    tasks.push(fetchDecisionsContext(repositoryId));
  }
  if (intents.includes("active")) {
    tasks.push(fetchActiveObjectivesContext(repositoryId));
  }

  blocks.push(...(await Promise.all(tasks)));
  return blocks;
}
