"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Network } from "lucide-react";

type Plan = { id: string; title: string; status: string };
type AgentRun = {
  id: string;
  planId: string | null;
  status: string;
  agentName: string;
  pullRequestUrl: string | null;
};
type Evaluation = { agentRunId: string | null };
type Decision = { selectedPlanId: string; selectedPlan: { title: string } };

function exploratoryRunsNeedingFollowUp(
  plans: Plan[],
  agentRuns: AgentRun[],
  evaluations: Evaluation[],
  decision: Decision
) {
  const evaluatedRunIds = new Set(
    evaluations
      .map((evaluation) => evaluation.agentRunId)
      .filter((id): id is string => Boolean(id))
  );

  return agentRuns.filter(
    (run) =>
      run.planId &&
      run.planId !== decision.selectedPlanId &&
      run.status === "COMPLETED" &&
      !evaluatedRunIds.has(run.id)
  );
}

export function CompletedObjectivePanel({
  objectiveId,
  plans,
  agentRuns,
  evaluations,
  decision,
  demoMode,
}: {
  objectiveId: string;
  plans: Plan[];
  agentRuns: AgentRun[];
  evaluations: Evaluation[];
  decision: Decision;
  demoMode?: boolean;
}) {
  if (demoMode) return null;

  const pendingFollowUp = exploratoryRunsNeedingFollowUp(
    plans,
    agentRuns,
    evaluations,
    decision
  );

  const planTitleById = new Map(plans.map((plan) => [plan.id, plan.title]));
  const rejectedPlans = plans.filter((plan) => plan.status === "REJECTED");

  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">Objective complete</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Decision recorded for{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {decision.selectedPlan.title}
            </span>
            . The knowledge graph reflects the path that shipped.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/knowledge-graph/${objectiveId}`}>
            <Network className="mr-2 h-4 w-4" />
            Knowledge Graph
          </Link>
        </Button>
      </div>

      {rejectedPlans.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-medium">Exploring rejected plans</p>
          <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
            You can run an agent on a rejected plan to see what it would have
            produced. That creates a branch and pull request for comparison only
            — it does not change the recorded decision or reopen the AI
            workflow. After merging a promising alternative, use{" "}
            <span className="font-medium">Revise Decision</span> on the Decision
            tab to switch the winning plan.
          </p>
        </div>
      )}

      {pendingFollowUp.length > 0 && (
        <div className="space-y-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
          <p className="font-medium">Follow up on alternative runs</p>
          <ul className="mt-2 space-y-2">
            {pendingFollowUp.map((run) => (
              <li key={run.id}>
                <span className="font-medium">
                  {run.planId
                    ? planTitleById.get(run.planId) ?? run.agentName
                    : run.agentName}
                </span>
                {" — "}
                {run.pullRequestUrl ? (
                  <>
                    review the{" "}
                    <a
                      href={run.pullRequestUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      pull request
                    </a>
                    , then{" "}
                  </>
                ) : null}
                add an evaluation on the Evaluations tab
                {run.pullRequestUrl
                  ? " and revise the decision if you want to switch plans"
                  : ""}
                .
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function isExploratoryPlanRun(params: {
  objectiveStatus: string;
  hasDecision: boolean;
  planId: string;
  planStatus: string;
  selectedPlanId?: string | null;
}) {
  if (params.objectiveStatus !== "COMPLETED" || !params.hasDecision) {
    return false;
  }

  if (params.selectedPlanId && params.planId === params.selectedPlanId) {
    return false;
  }

  return params.planStatus !== "SELECTED";
}
