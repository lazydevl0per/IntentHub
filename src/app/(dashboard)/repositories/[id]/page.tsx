import Link from "next/link";
import { notFound } from "next/navigation";
import { CreateObjectiveDialog } from "@/components/objective-forms";
import { RepoChat } from "@/components/repo-chat";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRepositoryPageData } from "@/lib/data/repository";
import { isDemoMode } from "@/lib/demo";
import { getAppSession } from "@/lib/session";
import { SyncRepositoryButton } from "@/components/sync-repo-button";

export default async function RepositoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAppSession();
  const userId = session!.user!.id;
  const { id } = await params;
  const demoMode = isDemoMode();

  const repository = await getRepositoryPageData(id, userId);

  if (!repository) notFound();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">Repository</p>
          <h1 className="text-3xl font-semibold">{repository.fullName}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {repository.branches.length} branches · Last synced{" "}
            {repository.lastSyncedAt
              ? repository.lastSyncedAt.toLocaleString()
              : "never"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/repositories/${repository.id}/settings`}>Settings</Link>
          </Button>
          <SyncRepositoryButton repositoryId={repository.id} demoMode={demoMode} />
          <CreateObjectiveDialog repositoryId={repository.id} demoMode={demoMode} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Objectives</h2>
            {repository.objectives.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-sm text-zinc-500">
                  No objectives yet. Create one to start versioning decisions.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {repository.objectives.map((objective) => (
                  <Link key={objective.id} href={`/objectives/${objective.id}`}>
                    <Card className="transition hover:border-zinc-400 dark:hover:border-zinc-600">
                      <CardContent className="flex items-center justify-between p-4">
                        <div>
                          <p className="font-medium">{objective.title}</p>
                          <p className="line-clamp-1 text-sm text-zinc-500">
                            {objective.description}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <StatusBadge value={objective.status} />
                          <StatusBadge value={objective.priority} />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Pull Requests</h2>
            <Card>
              <CardContent className="divide-y divide-zinc-200 p-0 dark:divide-zinc-800">
                {repository.pullRequests.length === 0 ? (
                  <p className="p-6 text-sm text-zinc-500">
                    No pull requests synced yet.
                  </p>
                ) : (
                  repository.pullRequests.map((pr) => (
                    <div key={pr.id} className="flex items-start justify-between gap-4 px-6 py-4">
                      <div>
                        <a
                          href={pr.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium hover:underline"
                        >
                          #{pr.number} {pr.title}
                        </a>
                        <p className="mt-1 text-xs text-zinc-500">
                          {pr.headBranch} → {pr.baseBranch}
                          {pr.mergedAt
                            ? ` · merged ${pr.mergedAt.toLocaleDateString()}`
                            : ""}
                        </p>
                      </div>
                      <StatusBadge value={pr.state} />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Recent Commits</h2>
            <Card>
              <CardContent className="divide-y divide-zinc-200 p-0 dark:divide-zinc-800">
                {repository.commits.length === 0 ? (
                  <p className="p-6 text-sm text-zinc-500">No commits synced yet.</p>
                ) : (
                  repository.commits.map((commit) => {
                    const insight = repository.commitInsights.find(
                      (i) => i.sha === commit.sha
                    );

                    return (
                      <div key={commit.id} className="px-6 py-4">
                        <p className="font-mono text-sm">{commit.sha.slice(0, 7)}</p>
                        <p className="text-sm">{commit.message}</p>
                        {insight && (
                          <div className="mt-2 space-y-1 rounded-md bg-zinc-50 p-2 text-xs dark:bg-zinc-900">
                            <p>
                              <span className="font-medium">Intent:</span>{" "}
                              {insight.intent}
                            </p>
                            {insight.archImpact && (
                              <p>
                                <span className="font-medium">Architecture:</span>{" "}
                                {insight.archImpact}
                              </p>
                            )}
                            {insight.perfImpact && (
                              <p>
                                <span className="font-medium">Performance:</span>{" "}
                                {insight.perfImpact}
                              </p>
                            )}
                            {insight.testStatus && (
                              <p>
                                <span className="font-medium">Tests:</span>{" "}
                                {insight.testStatus}
                              </p>
                            )}
                          </div>
                        )}
                        <p className="mt-1 text-xs text-zinc-500">
                          {commit.author} · {commit.committedAt.toLocaleDateString()}
                        </p>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </section>
        </div>

        <div>
          <RepoChat
            repositoryId={repository.id}
            demoMode={demoMode}
            lastSyncedAt={repository.lastSyncedAt?.toISOString() ?? null}
            objectives={repository.objectives.map((objective) => ({
              status: objective.status,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
