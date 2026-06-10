import {
  getDemoRepositoryMember,
  getDemoRepositoryPageData,
  getDemoRepositorySettingsData,
} from "@/lib/demo/fixtures";
import { isDemoMode } from "@/lib/demo";
import { prisma } from "@/lib/prisma";

export type RepositoryPageData = {
  id: string;
  fullName: string;
  lastSyncedAt: Date | null;
  branches: Array<{ id: string; name: string; headSha: string }>;
  objectives: Array<{
    id: string;
    title: string;
    description: string;
    status: string;
    priority: string;
  }>;
  commits: Array<{
    id: string;
    sha: string;
    message: string;
    author: string;
    committedAt: Date;
  }>;
  commitInsights: Array<{
    sha: string;
    intent: string;
    archImpact: string | null;
    perfImpact: string | null;
    testStatus: string | null;
  }>;
  pullRequests: Array<{
    id: string;
    number: number;
    title: string;
    state: string;
    headBranch: string;
    baseBranch: string;
    htmlUrl: string;
    mergedAt: Date | null;
  }>;
};

export type RepositorySettingsData = {
  repository: {
    id: string;
    fullName: string;
    lastSyncedAt: Date | null;
    githubWebhookId: number | null;
    agentSystemPrompt: string | null;
    branches: Array<{ id: string; name: string; headSha: string }>;
  };
  member: {
    role: string;
  };
};

export async function getRepositoryPageData(
  id: string,
  userId: string
): Promise<RepositoryPageData | null> {
  if (isDemoMode()) {
    const member = getDemoRepositoryMember(id, userId);
    if (!member) return null;
    return getDemoRepositoryPageData(id) as RepositoryPageData | null;
  }

  const member = await prisma.repositoryMember.findUnique({
    where: {
      userId_repositoryId: { userId, repositoryId: id },
    },
  });

  if (!member) return null;

  const repository = await prisma.repository.findUnique({
    where: { id },
    include: {
      objectives: {
        orderBy: { updatedAt: "desc" },
      },
      commits: {
        orderBy: { committedAt: "desc" },
        take: 15,
      },
      commitInsights: {
        orderBy: { createdAt: "desc" },
        take: 15,
      },
      branches: {
        orderBy: { name: "asc" },
      },
      pullRequests: {
        orderBy: { updatedAt: "desc" },
        take: 20,
      },
    },
  });

  if (!repository) return null;

  const { webhookSecret: _, ...safe } = repository;
  return safe as RepositoryPageData;
}

export async function getRepositorySettingsData(
  id: string,
  userId: string
): Promise<RepositorySettingsData | null> {
  if (isDemoMode()) {
    return getDemoRepositorySettingsData(id) as RepositorySettingsData | null;
  }

  const member = await prisma.repositoryMember.findUnique({
    where: {
      userId_repositoryId: { userId, repositoryId: id },
    },
  });

  if (!member) return null;

  const repository = await prisma.repository.findUnique({
    where: { id },
    include: {
      branches: {
        orderBy: { name: "asc" },
      },
    },
  });

  if (!repository) return null;

  const { webhookSecret: _, ...safeRepository } = repository;
  return {
    repository: safeRepository,
    member,
  } as unknown as RepositorySettingsData;
}
