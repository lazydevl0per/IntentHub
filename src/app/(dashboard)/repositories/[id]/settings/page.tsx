import Link from "next/link";
import { notFound } from "next/navigation";
import { AgentSystemPromptForm } from "@/components/agent-system-prompt-form";
import { DisconnectRepositoryButton } from "@/components/disconnect-repo-button";
import { SyncRepositoryButton } from "@/components/sync-repo-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Settings } from "lucide-react";

export default async function RepositorySettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const userId = session!.user!.id;
  const { id } = await params;

  const member = await prisma.repositoryMember.findUnique({
    where: {
      userId_repositoryId: { userId, repositoryId: id },
    },
  });

  if (!member) notFound();

  const repository = await prisma.repository.findUnique({
    where: { id },
    include: {
      branches: {
        orderBy: { name: "asc" },
      },
    },
  });

  if (!repository) notFound();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">
            <Link href={`/repositories/${repository.id}`} className="hover:underline">
              {repository.fullName}
            </Link>
          </p>
          <h1 className="flex items-center gap-2 text-3xl font-semibold">
            <Settings className="h-7 w-7" />
            Repository Settings
          </h1>
        </div>
        <Button asChild variant="outline">
          <Link href={`/repositories/${repository.id}`}>Back to Repository</Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sync</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-zinc-500">
              Last synced:{" "}
              {repository.lastSyncedAt
                ? repository.lastSyncedAt.toLocaleString()
                : "never"}
            </p>
            <SyncRepositoryButton repositoryId={repository.id} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Webhook</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Status:{" "}
              <span
                className={
                  repository.githubWebhookId
                    ? "font-medium text-green-700 dark:text-green-400"
                    : "font-medium text-amber-700 dark:text-amber-400"
                }
              >
                {repository.githubWebhookId ? "Registered" : "Not registered"}
              </span>
            </p>
            <p className="text-zinc-500">
              Endpoint: {appUrl}/api/webhooks/github
            </p>
            <p className="text-zinc-500">
              Events: push, create, delete
            </p>
            {!repository.githubWebhookId && (
              <p className="text-amber-700 dark:text-amber-400">
                Reconnect the repository or ensure NEXT_PUBLIC_APP_URL is set
                correctly for automatic webhook registration.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Agent Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            {member.role === "OWNER" ? (
              <AgentSystemPromptForm
                repositoryId={repository.id}
                initialPrompt={repository.agentSystemPrompt}
              />
            ) : (
              <p className="text-sm text-zinc-500">
                Only repository owners can edit the agent system prompt.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Branches ({repository.branches.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {repository.branches.length === 0 ? (
              <p className="text-sm text-zinc-500">No branches synced yet.</p>
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {repository.branches.map((branch) => (
                  <div
                    key={branch.id}
                    className="flex items-center justify-between py-3 text-sm"
                  >
                    <span className="font-mono">{branch.name}</span>
                    <span className="font-mono text-zinc-500">
                      {branch.headSha ? branch.headSha.slice(0, 7) : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-red-200 dark:border-red-900">
          <CardHeader>
            <CardTitle className="text-red-700 dark:text-red-400">
              Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DisconnectRepositoryButton
              repositoryId={repository.id}
              isOwner={member.role === "OWNER"}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
