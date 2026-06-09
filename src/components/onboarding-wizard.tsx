import Link from "next/link";
import { ConnectRepoDialog } from "@/components/connect-repo-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GitBranch, Target, Sparkles } from "lucide-react";

export function OnboardingWizard({ demoMode }: { demoMode?: boolean }) {
  if (demoMode) return null;

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Get started with IntentHub
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <GitBranch className="h-5 w-5 text-zinc-500" />
          <p className="font-medium">1. Connect a repository</p>
          <p className="text-sm text-zinc-500">
            Link GitHub so commits, branches, and webhooks stay in sync.
          </p>
          <ConnectRepoDialog demoMode={demoMode} />
        </div>
        <div className="space-y-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <Target className="h-5 w-5 text-zinc-500" />
          <p className="font-medium">2. Create an objective</p>
          <p className="text-sm text-zinc-500">
            Capture intent before code changes so decisions survive merges.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/">Open dashboard</Link>
          </Button>
        </div>
        <div className="space-y-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <Sparkles className="h-5 w-5 text-zinc-500" />
          <p className="font-medium">3. Run an agent on a plan</p>
          <p className="text-sm text-zinc-500">
            Generate a branch, file edits, and a pull request from a plan.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/">Explore objectives</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
