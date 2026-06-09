"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function LinkGitHubBanner() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900 dark:bg-amber-950/40">
      <div>
        <p className="font-medium text-amber-900 dark:text-amber-100">
          Link your GitHub account
        </p>
        <p className="text-sm text-amber-800 dark:text-amber-200/80">
          Connect repositories and sync commits by signing in with GitHub.
        </p>
      </div>
      <Button
        variant="outline"
        className="shrink-0 border-amber-300 bg-white dark:border-amber-800 dark:bg-zinc-950"
        onClick={() => signIn("github", { callbackUrl: "/" })}
      >
        Link GitHub
      </Button>
    </div>
  );
}
