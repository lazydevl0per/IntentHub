import Link from "next/link";
import { ConnectRepoDialog } from "@/components/connect-repo-dialog";
import { EmptyState } from "@/components/app-shell";
import { LinkGitHubBanner } from "@/components/link-github-banner";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { getUserGitHubToken } from "@/lib/github";
import { prisma } from "@/lib/prisma";
import { GitBranch, Target } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id;

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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-zinc-500">
            Objectives, decisions, and repository knowledge at a glance.
          </p>
        </div>
        <ConnectRepoDialog />
      </div>

      {!githubToken && <LinkGitHubBanner />}

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-500">
              Repositories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{repositories.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-500">
              Active Objectives
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{activeObjectives.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-500">
              Recent Decisions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{recentDecisions.length}</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Repositories</h2>
          {repositories.length === 0 ? (
            <EmptyState
              title="No repositories connected"
              description="Connect a GitHub repository to start tracking objectives and decisions."
            />
          ) : (
            <div className="grid gap-4">
              {repositories.map((repo) => (
                <Link key={repo.id} href={`/repositories/${repo.id}`}>
                  <Card className="transition hover:border-zinc-400 dark:hover:border-zinc-600">
                    <CardContent className="flex items-center justify-between p-6">
                      <div>
                        <p className="font-medium">{repo.fullName}</p>
                        <p className="text-sm text-zinc-500">
                          {repo._count.objectives} objectives · {repo._count.commits} commits
                        </p>
                      </div>
                      <GitBranch className="h-5 w-5 text-zinc-400" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Active Objectives</h2>
          {activeObjectives.length === 0 ? (
            <EmptyState
              title="No active objectives"
              description="Create an objective inside a repository to begin capturing intent."
              icon={<Target className="mb-4 h-10 w-10 text-zinc-400" />}
            />
          ) : (
            <div className="space-y-3">
              {activeObjectives.map((objective) => (
                <Link key={objective.id} href={`/objectives/${objective.id}`}>
                  <Card className="transition hover:border-zinc-400 dark:hover:border-zinc-600">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium">{objective.title}</p>
                          <p className="text-sm text-zinc-500">
                            {objective.repository.fullName}
                          </p>
                        </div>
                        <StatusBadge value={objective.priority} />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Recent Decisions</h2>
        {recentDecisions.length === 0 ? (
          <EmptyState
            title="No decisions recorded"
            description="When objectives are completed, decisions become permanent project knowledge."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {recentDecisions.map((decision) => (
              <Link
                key={decision.id}
                href={`/objectives/${decision.objectiveId}`}
              >
                <Card>
                  <CardContent className="space-y-2 p-6">
                    <p className="font-medium">{decision.objective.title}</p>
                    <p className="text-sm text-zinc-500">
                      Selected: {decision.selectedPlan.title}
                    </p>
                    <p className="line-clamp-2 text-sm">{decision.rationale}</p>
                    <p className="text-xs text-zinc-400">
                      Approved by {decision.approvedBy.name} ·{" "}
                      {decision.approvedAt.toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
