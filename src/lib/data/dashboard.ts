import { getDemoDashboardData } from "@/lib/demo/fixtures";
import { isDemoMode } from "@/lib/demo";
import { getUserGitHubToken } from "@/lib/github";
import { prisma } from "@/lib/prisma";

export async function getDashboardData(userId: string) {
  if (isDemoMode()) {
    return getDemoDashboardData();
  }

  const [repositories, activeObjectives, recentDecisions, githubToken] =
    await Promise.all([
      prisma.repository.findMany({
        where: {
          members: { some: { userId } },
        },
        include: {
          _count: {
            select: { objectives: true, commits: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.objective.findMany({
        where: {
          status: "ACTIVE",
          repository: {
            members: { some: { userId } },
          },
        },
        include: {
          repository: true,
        },
        take: 8,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.decision.findMany({
        where: {
          objective: {
            repository: {
              members: { some: { userId } },
            },
          },
        },
        include: {
          objective: {
            include: { repository: true },
          },
          selectedPlan: true,
          approvedBy: {
            select: { name: true },
          },
        },
        take: 6,
        orderBy: { approvedAt: "desc" },
      }),
      getUserGitHubToken(userId),
    ]);

  return { repositories, activeObjectives, recentDecisions, githubToken };
}
