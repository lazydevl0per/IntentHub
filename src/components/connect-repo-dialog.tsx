"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

type GitHubRepo = {
  githubId: number;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
};

export function ConnectRepoDialog({ demoMode }: { demoMode?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    setError("");
    fetch("/api/repositories/github")
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Failed to load repositories");
        }
        return res.json();
      })
      .then(setRepos)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open]);

  async function connectRepo(repo: GitHubRepo) {
    setConnecting(repo.githubId);
    setError("");

    const res = await fetch("/api/repositories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(repo),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to connect repository");
      setConnecting(null);
      return;
    }

    const data = await res.json();

    if (data.syncStatus === "failed") {
      setError(
        `Repository connected but sync failed: ${data.syncError ?? "Unknown error"}. Use Sync on the repository page to retry.`
      );
    } else if (data.syncStatus === "queued") {
      setError("");
    } else if (data.webhookStatus === "failed") {
      setError(
        `Repository connected but webhook registration failed: ${data.webhookError ?? "Unknown error"}. Check Settings to configure manually.`
      );
    }

    if (data.syncStatus === "failed" || data.webhookStatus === "failed") {
      setConnecting(null);
      setOpen(false);
      router.push(`/repositories/${data.id}`);
      router.refresh();
      return;
    }

    setOpen(false);
    setConnecting(null);
    router.push(`/repositories/${data.id}`);
    router.refresh();
  }

  if (demoMode) {
    return (
      <Button disabled title="Demo mode — read only">
        Connect Repository
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Connect Repository</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect GitHub Repository</DialogTitle>
        </DialogHeader>
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        {loading ? (
          <p className="text-sm text-zinc-500">Loading repositories...</p>
        ) : repos.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No repositories found. Sign in with GitHub OAuth to grant repo access.
          </p>
        ) : (
          <ScrollArea className="h-80 pr-4">
            <div className="space-y-2">
              {repos.map((repo) => (
                <button
                  key={repo.githubId}
                  type="button"
                  onClick={() => connectRepo(repo)}
                  disabled={connecting === repo.githubId}
                  className="flex w-full items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 text-left hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  <div>
                    <p className="font-medium">{repo.fullName}</p>
                    <p className="text-xs text-zinc-500">
                      Default branch: {repo.defaultBranch}
                    </p>
                  </div>
                  <span className="text-xs text-zinc-500">
                    {connecting === repo.githubId ? "Connecting..." : repo.private ? "Private" : "Public"}
                  </span>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
