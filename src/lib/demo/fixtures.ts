import { DEMO_USER_ID } from "@/lib/demo";

const now = new Date("2026-06-01T12:00:00Z");
const weekAgo = new Date("2026-05-25T10:00:00Z");

export const DEMO_REPO_ID = "demo-repo";
export const DEMO_OBJECTIVE_COMPLETED_ID = "seed-objective-1";
export const DEMO_OBJECTIVE_ACTIVE_ID = "demo-objective-2";
export const DEMO_PLAN_A_ID = "demo-plan-a";
export const DEMO_PLAN_B_ID = "demo-plan-b";
export const DEMO_PLAN_STRIPE_A_ID = "demo-plan-stripe-a";
export const DEMO_PLAN_STRIPE_B_ID = "demo-plan-stripe-b";
export const DEMO_AGENT_RUN_ID = "demo-agent-run-1";
export const DEMO_AGENT_RUN_STRIPE_ID = "demo-agent-run-stripe-1";
export const DEMO_EVALUATION_ID = "demo-evaluation-1";
export const DEMO_DECISION_ID = "demo-decision-1";
export const DEMO_COMMIT_ID = "demo-commit-1";
export const DEMO_COMMIT_SHA = "a1b2c3d4e5f6789012345678abcdef9012345678";
export const DEMO_CHAT_SESSION_ID = "demo-chat-1";

const demoUser = {
  id: DEMO_USER_ID,
  name: "Demo User",
  email: "demo@intenthub.dev",
};

const demoRepository = {
  id: DEMO_REPO_ID,
  githubId: 10001,
  owner: "intenthub",
  name: "demo-app",
  fullName: "intenthub/demo-app",
  defaultBranch: "main",
  webhookSecret: null,
  githubWebhookId: 42,
  lastSyncedAt: now,
  agentSystemPrompt:
    "You are an expert software engineer working on the IntentHub demo application.",
  createdAt: weekAgo,
  updatedAt: now,
};

const demoBranches = [
  {
    id: "demo-branch-main",
    repositoryId: DEMO_REPO_ID,
    name: "main",
    headSha: "b2c3d4e5f6789012345678abcdef901234567890",
    updatedAt: now,
  },
  {
    id: "demo-branch-feat",
    repositoryId: DEMO_REPO_ID,
    name: "feat/redis-cache",
    headSha: DEMO_COMMIT_SHA,
    updatedAt: now,
  },
];

const demoCommit = {
  id: DEMO_COMMIT_ID,
  repositoryId: DEMO_REPO_ID,
  sha: DEMO_COMMIT_SHA,
  message: "feat: add Redis caching layer",
  author: "Demo User",
  committedAt: now,
  parentShas: [] as string[],
};

const demoCommitInsight = {
  id: "demo-commit-insight-1",
  repositoryId: DEMO_REPO_ID,
  sha: DEMO_COMMIT_SHA,
  objectiveId: DEMO_OBJECTIVE_COMPLETED_ID,
  intent: "Introduce Redis caching to reduce API latency on hot read paths.",
  archImpact: "Adds a Redis layer between the API and PostgreSQL for cacheable queries.",
  perfImpact: "P95 latency reduced from 420ms to 158ms on /api/users.",
  testStatus: "All integration tests passing; load test benchmark included.",
  createdAt: now,
};

const demoObjectiveCompleted = {
  id: DEMO_OBJECTIVE_COMPLETED_ID,
  title: "Reduce API latency by 50%",
  description:
    "Improve API response times for the top 10 endpoints used by customers.",
  status: "COMPLETED" as const,
  priority: "HIGH" as const,
  repositoryId: DEMO_REPO_ID,
  creatorId: DEMO_USER_ID,
  createdAt: weekAgo,
  updatedAt: now,
  businessSummary:
    "Customer-facing API latency was a top support complaint. Redis caching on hot read paths delivered a 62% P95 improvement with manageable operational overhead.",
  technicalSummary:
    "Added Redis client with TTL-based cache middleware on /api/users and related endpoints. Cache invalidation hooks on write operations.",
  risks: "Cache staleness on rapid data changes; mitigated with short TTLs and explicit invalidation.",
  architectureImpact:
    "New Redis dependency in the API tier. Deployment requires Redis instance alongside PostgreSQL.",
};

const demoObjectiveActive = {
  id: DEMO_OBJECTIVE_ACTIVE_ID,
  title: "Add Stripe subscription billing",
  description:
    "Implement subscription tiers with Stripe Checkout and webhook handling for plan changes.",
  status: "ACTIVE" as const,
  priority: "CRITICAL" as const,
  repositoryId: DEMO_REPO_ID,
  creatorId: DEMO_USER_ID,
  createdAt: now,
  updatedAt: now,
  businessSummary: null,
  technicalSummary: null,
  risks: null,
  architectureImpact: null,
};

const demoPlanA = {
  id: DEMO_PLAN_A_ID,
  objectiveId: DEMO_OBJECTIVE_COMPLETED_ID,
  title: "Add Redis caching",
  description: "Cache frequent read queries in Redis.",
  approach: "Introduce Redis layer in front of PostgreSQL for hot paths.",
  status: "SELECTED" as const,
  createdById: DEMO_USER_ID,
  createdAt: weekAgo,
  updatedAt: now,
};

const demoPlanB = {
  id: DEMO_PLAN_B_ID,
  objectiveId: DEMO_OBJECTIVE_COMPLETED_ID,
  title: "Optimize database indexes",
  description: "Add composite indexes for slow queries.",
  approach: "Analyze query plans and add targeted indexes.",
  status: "REJECTED" as const,
  createdById: DEMO_USER_ID,
  createdAt: weekAgo,
  updatedAt: now,
};

const demoPlanStripeA = {
  id: DEMO_PLAN_STRIPE_A_ID,
  objectiveId: DEMO_OBJECTIVE_ACTIVE_ID,
  title: "Stripe Checkout integration",
  description: "Use Stripe Checkout hosted pages for subscription signup.",
  approach:
    "Add Stripe Checkout session creation, customer portal, and webhook handlers for subscription events.",
  status: "ACTIVE" as const,
  createdById: DEMO_USER_ID,
  createdAt: now,
  updatedAt: now,
};

const demoPlanStripeB = {
  id: DEMO_PLAN_STRIPE_B_ID,
  objectiveId: DEMO_OBJECTIVE_ACTIVE_ID,
  title: "Custom billing UI",
  description: "Build in-app subscription management with Stripe Elements.",
  approach:
    "Embed Stripe Elements for payment collection and manage subscriptions via Stripe API directly.",
  status: "DRAFT" as const,
  createdById: DEMO_USER_ID,
  createdAt: now,
  updatedAt: now,
};

const demoAgentRun = {
  id: DEMO_AGENT_RUN_ID,
  objectiveId: DEMO_OBJECTIVE_COMPLETED_ID,
  planId: DEMO_PLAN_A_ID,
  agentName: "Cursor Agent",
  model: "gpt-4o",
  prompt: "Implement Redis caching for /api/users endpoint",
  output: "Added Redis client, cache middleware, and TTL configuration.",
  branchName: "feat/redis-cache",
  status: "COMPLETED" as const,
  promptTokens: 1240,
  completionTokens: 890,
  errorMessage: null,
  createdById: DEMO_USER_ID,
  createdAt: weekAgo,
  updatedAt: now,
};

const demoAgentRunStripe = {
  id: DEMO_AGENT_RUN_STRIPE_ID,
  objectiveId: DEMO_OBJECTIVE_ACTIVE_ID,
  planId: DEMO_PLAN_STRIPE_A_ID,
  agentName: "IntentHub Agent",
  model: "gpt-4o-mini",
  prompt: "Scaffold Stripe Checkout integration with webhook handlers",
  output:
    "Created checkout session API route, webhook endpoint for subscription events, and customer portal link generation.",
  branchName: "feat/stripe-checkout",
  status: "COMPLETED" as const,
  promptTokens: 980,
  completionTokens: 620,
  errorMessage: null,
  createdById: DEMO_USER_ID,
  createdAt: now,
  updatedAt: now,
};

const demoEvaluation = {
  id: DEMO_EVALUATION_ID,
  objectiveId: DEMO_OBJECTIVE_COMPLETED_ID,
  planId: DEMO_PLAN_A_ID,
  agentRunId: DEMO_AGENT_RUN_ID,
  type: "BENCHMARK" as const,
  score: 92,
  summary: "P95 latency reduced from 420ms to 158ms (62% improvement).",
  rawJson: null,
  createdById: DEMO_USER_ID,
  createdAt: now,
};

const demoDecision = {
  id: DEMO_DECISION_ID,
  objectiveId: DEMO_OBJECTIVE_COMPLETED_ID,
  selectedPlanId: DEMO_PLAN_A_ID,
  rationale:
    "Redis caching delivered the largest latency improvement with acceptable operational complexity compared to index-only optimization.",
  linkedCommitSha: "a1b2c3d",
  approvedById: DEMO_USER_ID,
  approvedAt: now,
};

const demoChatMessages = [
  {
    id: "demo-msg-1",
    sessionId: DEMO_CHAT_SESSION_ID,
    role: "user",
    content: "Why was Redis chosen over database indexes?",
    createdAt: weekAgo,
  },
  {
    id: "demo-msg-2",
    sessionId: DEMO_CHAT_SESSION_ID,
    role: "assistant",
    content:
      "Redis caching was selected because it delivered a 62% P95 latency reduction (420ms → 158ms) on hot read paths. Index optimization alone would have required schema changes across multiple tables with smaller gains. The team evaluated both approaches — see Plan A (selected) and Plan B (rejected) on the objective page.",
    createdAt: weekAgo,
  },
];

export function getDemoDashboardData() {
  const repository = {
    ...demoRepository,
    _count: { objectives: 2, commits: 1 },
  };

  const activeObjectives = [
    {
      ...demoObjectiveActive,
      repository: demoRepository,
    },
  ];

  const recentDecisions = [
    {
      ...demoDecision,
      objective: {
        ...demoObjectiveCompleted,
        repository: demoRepository,
      },
      selectedPlan: demoPlanA,
      approvedBy: { name: demoUser.name },
    },
  ];

  return {
    repositories: [repository],
    activeObjectives,
    recentDecisions,
    githubToken: null as string | null,
  };
}

export function getDemoRepositoryPageData(repositoryId: string) {
  if (repositoryId !== DEMO_REPO_ID) return null;

  return {
    ...demoRepository,
    objectives: [demoObjectiveCompleted, demoObjectiveActive],
    commits: [demoCommit],
    commitInsights: [demoCommitInsight],
    branches: demoBranches,
    pullRequests: [
      {
        id: "demo-pr-1",
        number: 42,
        title: "feat: add Redis caching layer",
        state: "MERGED",
        headBranch: "feat/redis-cache",
        baseBranch: "main",
        htmlUrl: "https://github.com/intenthub/demo-app/pull/42",
        mergedAt: now,
      },
    ],
  };
}

export function getDemoRepositorySettingsData(repositoryId: string) {
  if (repositoryId !== DEMO_REPO_ID) return null;

  return {
    repository: {
      ...demoRepository,
      branches: demoBranches,
    },
    member: {
      id: "demo-member-1",
      userId: DEMO_USER_ID,
      repositoryId: DEMO_REPO_ID,
      role: "OWNER" as const,
      createdAt: weekAgo,
    },
  };
}

export function getDemoRepositoryMember(repositoryId: string, userId: string) {
  if (repositoryId !== DEMO_REPO_ID || userId !== DEMO_USER_ID) return null;
  return {
    id: "demo-member-1",
    userId: DEMO_USER_ID,
    repositoryId: DEMO_REPO_ID,
    role: "OWNER" as const,
    createdAt: weekAgo,
  };
}

export function getDemoObjectivePageData(objectiveId: string) {
  const objectives = [demoObjectiveCompleted, demoObjectiveActive];
  const objective = objectives.find((o) => o.id === objectiveId);
  if (!objective) return null;

  const plans =
    objectiveId === DEMO_OBJECTIVE_COMPLETED_ID
      ? [demoPlanA, demoPlanB]
      : objectiveId === DEMO_OBJECTIVE_ACTIVE_ID
        ? [demoPlanStripeA, demoPlanStripeB]
        : [];

  const agentRuns =
    objectiveId === DEMO_OBJECTIVE_COMPLETED_ID
      ? [demoAgentRun]
      : objectiveId === DEMO_OBJECTIVE_ACTIVE_ID
        ? [demoAgentRunStripe]
        : [];

  const evaluations =
    objectiveId === DEMO_OBJECTIVE_COMPLETED_ID ? [demoEvaluation] : [];

  const decision =
    objectiveId === DEMO_OBJECTIVE_COMPLETED_ID
      ? {
          ...demoDecision,
          selectedPlan: demoPlanA,
          approvedBy: { name: demoUser.name, email: demoUser.email },
        }
      : null;

  return {
    ...objective,
    creator: { name: demoUser.name },
    repository: {
      ...demoRepository,
      members: [
        {
          id: "demo-member-1",
          userId: DEMO_USER_ID,
          repositoryId: DEMO_REPO_ID,
          role: "OWNER" as const,
          createdAt: weekAgo,
        },
      ],
      commits: [demoCommit],
    },
    plans: plans.map((plan) => ({
      ...plan,
      createdBy: { name: demoUser.name },
    })),
    agentRuns: agentRuns.map((run) => ({
      ...run,
      plan:
        run.planId === DEMO_PLAN_A_ID
          ? demoPlanA
          : run.planId === DEMO_PLAN_STRIPE_A_ID
            ? demoPlanStripeA
            : null,
      createdBy: { name: demoUser.name },
    })),
    evaluations: evaluations.map((evaluation) => ({
      ...evaluation,
      plan: demoPlanA,
      agentRun: demoAgentRun,
      createdBy: { name: demoUser.name },
    })),
    decision,
  };
}

export function getDemoObjectiveAccess(objectiveId: string, userId: string) {
  if (userId !== DEMO_USER_ID) return null;
  const objective = getDemoObjectivePageData(objectiveId);
  if (!objective) return null;
  return objective;
}

export function getDemoGraphData(objectiveId: string) {
  if (objectiveId === DEMO_OBJECTIVE_COMPLETED_ID) {
    return buildCompletedObjectiveGraph();
  }

  if (objectiveId === DEMO_OBJECTIVE_ACTIVE_ID) {
    return buildActiveObjectiveGraph();
  }

  return null;
}

function buildCompletedObjectiveGraph() {
  const nodes: Array<{
    id: string;
    type: string;
    label: string;
    data?: Record<string, unknown>;
  }> = [];
  const edges: Array<{ id: string; source: string; target: string }> = [];

  nodes.push({
    id: `objective-${demoObjectiveCompleted.id}`,
    type: "objective",
    label: demoObjectiveCompleted.title,
    data: { status: demoObjectiveCompleted.status },
  });

  for (const plan of [demoPlanA, demoPlanB]) {
    nodes.push({
      id: `plan-${plan.id}`,
      type: "plan",
      label: plan.title,
      data: { status: plan.status },
    });
    edges.push({
      id: `edge-objective-plan-${plan.id}`,
      source: `objective-${demoObjectiveCompleted.id}`,
      target: `plan-${plan.id}`,
    });
  }

  nodes.push({
    id: `run-${demoAgentRun.id}`,
    type: "agentRun",
    label: demoAgentRun.agentName,
    data: { status: demoAgentRun.status, model: demoAgentRun.model },
  });
  edges.push({
    id: `edge-run-${demoAgentRun.id}`,
    source: `plan-${demoPlanA.id}`,
    target: `run-${demoAgentRun.id}`,
  });

  nodes.push({
    id: `eval-${demoEvaluation.id}`,
    type: "evaluation",
    label: `${demoEvaluation.type} (${demoEvaluation.score})`,
    data: { type: demoEvaluation.type, score: demoEvaluation.score },
  });
  edges.push({
    id: `edge-eval-${demoEvaluation.id}`,
    source: `run-${demoAgentRun.id}`,
    target: `eval-${demoEvaluation.id}`,
  });

  nodes.push({
    id: `decision-${demoDecision.id}`,
    type: "decision",
    label: "Decision",
    data: { rationale: demoDecision.rationale },
  });
  edges.push({
    id: `edge-decision-plan-${demoDecision.selectedPlanId}`,
    source: `plan-${demoDecision.selectedPlanId}`,
    target: `decision-${demoDecision.id}`,
  });

  nodes.push({
    id: `commit-${demoCommit.id}`,
    type: "commit",
    label: demoCommit.sha.slice(0, 7),
    data: { message: demoCommit.message },
  });
  edges.push({
    id: `edge-decision-commit-${demoCommit.id}`,
    source: `decision-${demoDecision.id}`,
    target: `commit-${demoCommit.id}`,
  });

  return { nodes, edges };
}

function buildActiveObjectiveGraph() {
  const nodes: Array<{
    id: string;
    type: string;
    label: string;
    data?: Record<string, unknown>;
  }> = [];
  const edges: Array<{ id: string; source: string; target: string }> = [];

  nodes.push({
    id: `objective-${demoObjectiveActive.id}`,
    type: "objective",
    label: demoObjectiveActive.title,
    data: { status: demoObjectiveActive.status },
  });

  for (const plan of [demoPlanStripeA, demoPlanStripeB]) {
    nodes.push({
      id: `plan-${plan.id}`,
      type: "plan",
      label: plan.title,
      data: { status: plan.status },
    });
    edges.push({
      id: `edge-objective-plan-${plan.id}`,
      source: `objective-${demoObjectiveActive.id}`,
      target: `plan-${plan.id}`,
    });
  }

  nodes.push({
    id: `run-${demoAgentRunStripe.id}`,
    type: "agentRun",
    label: demoAgentRunStripe.agentName,
    data: { status: demoAgentRunStripe.status, model: demoAgentRunStripe.model },
  });
  edges.push({
    id: `edge-run-${demoAgentRunStripe.id}`,
    source: `plan-${demoPlanStripeA.id}`,
    target: `run-${demoAgentRunStripe.id}`,
  });

  return { nodes, edges };
}

export function getDemoChatSessions(repositoryId: string) {
  if (repositoryId !== DEMO_REPO_ID) return [];
  return [
    {
      id: DEMO_CHAT_SESSION_ID,
      repositoryId: DEMO_REPO_ID,
      userId: DEMO_USER_ID,
      title: "Why was Redis chosen over database indexes?",
      createdAt: weekAgo,
      updatedAt: now,
      _count: { messages: demoChatMessages.length },
    },
  ];
}

export function getDemoChatSession(repositoryId: string, sessionId: string) {
  if (repositoryId !== DEMO_REPO_ID || sessionId !== DEMO_CHAT_SESSION_ID) {
    return null;
  }
  return {
    id: DEMO_CHAT_SESSION_ID,
    repositoryId: DEMO_REPO_ID,
    userId: DEMO_USER_ID,
    title: "Why was Redis chosen over database indexes?",
    createdAt: weekAgo,
    updatedAt: now,
    messages: demoChatMessages,
  };
}
