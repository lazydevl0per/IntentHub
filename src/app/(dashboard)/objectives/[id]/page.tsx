import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CreateAgentRunForm,
  CreateDecisionForm,
  CreateEvaluationForm,
  CreatePlanForm,
  EditObjectiveDialog,
  EditPlanDialog,
} from "@/components/objective-forms";
import { ObjectiveSummary } from "@/components/objective-summary";
import { RunAgentButton, RunAgentForm } from "@/components/run-agent-form";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getObjectivePageData } from "@/lib/data/objective";
import { isDemoMode } from "@/lib/demo";
import { getAppSession } from "@/lib/session";
import { Network } from "lucide-react";

export default async function ObjectivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAppSession();
  const userId = session!.user!.id;
  const { id } = await params;
  const demoMode = isDemoMode();

  const objective = await getObjectivePageData(id, userId);

  if (!objective) notFound();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">
            <Link
              href={`/repositories/${objective.repositoryId}`}
              className="hover:underline"
            >
              {objective.repository.fullName}
            </Link>
          </p>
          <h1 className="text-3xl font-semibold">{objective.title}</h1>
          <p className="mt-2 max-w-3xl text-zinc-600 dark:text-zinc-400">
            {objective.description}
          </p>
          <div className="mt-3 flex gap-2">
            <StatusBadge value={objective.status} />
            <StatusBadge value={objective.priority} />
          </div>
        </div>
        <div className="flex gap-2">
          <EditObjectiveDialog
            objective={{
              id: objective.id,
              title: objective.title,
              description: objective.description,
              status: objective.status,
              priority: objective.priority,
            }}
            demoMode={demoMode}
          />
          <Button asChild variant="outline">
            <Link href={`/knowledge-graph/${objective.id}`}>
              <Network className="mr-2 h-4 w-4" />
              Knowledge Graph
            </Link>
          </Button>
        </div>
      </div>

      {objective.status === "COMPLETED" && (
        <ObjectiveSummary objective={objective} />
      )}

      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="runs">Agent Runs</TabsTrigger>
          <TabsTrigger value="evaluations">Evaluations</TabsTrigger>
          <TabsTrigger value="decision">Decision</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {objective.plans.map((plan, index) => (
              <Card key={plan.id}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <CardTitle className="text-lg">
                    Plan {String.fromCharCode(65 + index)}: {plan.title}
                  </CardTitle>
                  <div className="flex gap-2">
                    <RunAgentButton
                      objectiveId={objective.id}
                      planId={plan.id}
                      demoMode={demoMode}
                    />
                    <EditPlanDialog
                      plan={{
                        id: plan.id,
                        title: plan.title,
                        description: plan.description,
                        approach: plan.approach,
                        status: plan.status,
                      }}
                      demoMode={demoMode}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>{plan.description}</p>
                  <p className="text-zinc-500">{plan.approach}</p>
                  <StatusBadge value={plan.status} />
                </CardContent>
              </Card>
            ))}
          </div>
          <CreatePlanForm objectiveId={objective.id} demoMode={demoMode} />
        </TabsContent>

        <TabsContent value="runs" className="space-y-4">
          {objective.agentRuns.length === 0 ? (
            <p className="text-sm text-zinc-500">No agent runs recorded.</p>
          ) : (
            objective.agentRuns.map((run) => (
              <Card key={run.id}>
                <CardContent className="space-y-2 p-6">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{run.agentName}</p>
                    <StatusBadge value={run.status} />
                  </div>
                  <p className="text-sm text-zinc-500">
                    Model: {run.model ?? "—"} · Branch: {run.branchName ?? "—"}
                    {(run.promptTokens ?? run.completionTokens) != null && (
                      <>
                        {" "}
                        · Tokens: {run.promptTokens ?? 0}+{run.completionTokens ?? 0}
                      </>
                    )}
                  </p>
                  {run.errorMessage && (
                    <p className="text-sm text-red-600">{run.errorMessage}</p>
                  )}
                  <p className="text-sm">
                    <span className="font-medium">Prompt:</span> {run.prompt}
                  </p>
                  {run.output ? (
                    <p className="line-clamp-4 text-sm text-zinc-600 dark:text-zinc-400">
                      {run.output}
                    </p>
                  ) : run.status === "PENDING" || run.status === "RUNNING" ? (
                    <p className="text-sm text-zinc-500">Agent is working...</p>
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}
          <RunAgentForm
            objectiveId={objective.id}
            plans={objective.plans.map((p) => ({ id: p.id, title: p.title }))}
            demoMode={demoMode}
          />
          <CreateAgentRunForm
            objectiveId={objective.id}
            plans={objective.plans.map((p) => ({ id: p.id, title: p.title }))}
            demoMode={demoMode}
          />
        </TabsContent>

        <TabsContent value="evaluations" className="space-y-4">
          {objective.evaluations.length === 0 ? (
            <p className="text-sm text-zinc-500">No evaluations recorded.</p>
          ) : (
            objective.evaluations.map((evaluation) => (
              <Card key={evaluation.id}>
                <CardContent className="flex items-start justify-between p-6">
                  <div>
                    <p className="font-medium">{evaluation.type}</p>
                    <p className="text-sm">{evaluation.summary}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold">{evaluation.score}</p>
                    <p className="text-xs text-zinc-500">score</p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
          <CreateEvaluationForm
            objectiveId={objective.id}
            plans={objective.plans.map((p) => ({ id: p.id, title: p.title }))}
            agentRuns={objective.agentRuns.map((r) => ({
              id: r.id,
              agentName: r.agentName,
            }))}
            demoMode={demoMode}
          />
        </TabsContent>

        <TabsContent value="decision" className="space-y-4">
          {objective.decision ? (
            <Card>
              <CardHeader>
                <CardTitle>Final Decision</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="font-medium">
                  Selected plan: {objective.decision.selectedPlan.title}
                </p>
                <p>{objective.decision.rationale}</p>
                {objective.decision.linkedCommitSha && (
                  <p className="font-mono text-sm text-zinc-500">
                    Commit: {objective.decision.linkedCommitSha.slice(0, 7)}
                  </p>
                )}
                <p className="text-sm text-zinc-500">
                  Approved by {objective.decision.approvedBy.name} on{" "}
                  {objective.decision.approvedAt.toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-zinc-500">
              No decision recorded yet. Select the winning plan when the objective is complete.
            </p>
          )}
          <CreateDecisionForm
            objectiveId={objective.id}
            plans={objective.plans.map((p) => ({ id: p.id, title: p.title }))}
            commits={objective.repository.commits.map((c) => ({
              sha: c.sha,
              message: c.message,
            }))}
            demoMode={demoMode}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
