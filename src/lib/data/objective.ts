import {
  getDemoObjectiveAccess,
  getDemoObjectivePageData,
} from "@/lib/demo/fixtures";
import { isDemoMode } from "@/lib/demo";
import { prisma } from "@/lib/prisma";

export type ObjectivePageData = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  repositoryId: string;
  businessSummary: string | null;
  technicalSummary: string | null;
  risks: string | null;
  architectureImpact: string | null;
  repository: {
    fullName: string;
    commits: Array<{ sha: string; message: string }>;
  };
  plans: Array<{
    id: string;
    title: string;
    description: string;
    approach: string;
    status: string;
  }>;
  agentRuns: Array<{
    id: string;
    agentName: string;
    model: string | null;
    prompt: string;
    output: string;
    branchName: string | null;
    status: string;
    promptTokens: number | null;
    completionTokens: number | null;
    errorMessage: string | null;
    filesChanged: number | null;
    pullRequestUrl: string | null;
    pullRequestNumber: number | null;
  }>;
  evaluations: Array<{
    id: string;
    type: string;
    score: number;
    summary: string;
  }>;
  decision: {
    selectedPlan: { title: string };
    rationale: string;
    linkedCommitSha: string | null;
    approvedBy: { name: string | null };
    approvedAt: Date;
  } | null;
};

export async function getObjectivePageData(
  id: string,
  userId: string
): Promise<ObjectivePageData | null> {
  if (isDemoMode()) {
    const objective = getDemoObjectivePageData(id);
    if (!objective || objective.repository.members.length === 0) return null;
    return objective as unknown as ObjectivePageData;
  }

  const objective = await prisma.objective.findUnique({
    where: { id },
    include: {
      creator: { select: { name: true } },
      repository: {
        include: {
          members: { where: { userId } },
          commits: { orderBy: { committedAt: "desc" }, take: 30 },
        },
      },
      plans: {
        include: {
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      agentRuns: {
        include: {
          plan: true,
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      evaluations: {
        include: {
          plan: true,
          agentRun: true,
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      decision: {
        include: {
          selectedPlan: true,
          approvedBy: { select: { name: true, email: true } },
        },
      },
    },
  });

  if (!objective || objective.repository.members.length === 0) {
    return null;
  }

  return objective as unknown as ObjectivePageData;
}

export async function getObjectiveAccess(objectiveId: string, userId: string) {
  if (isDemoMode()) {
    return getDemoObjectiveAccess(objectiveId, userId);
  }

  const objective = await prisma.objective.findUnique({
    where: { id: objectiveId },
    include: {
      repository: {
        include: {
          members: {
            where: { userId },
          },
        },
      },
    },
  });

  if (!objective || objective.repository.members.length === 0) {
    return null;
  }

  return objective;
}
