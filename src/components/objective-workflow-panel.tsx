"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { EditPlanDialog } from "@/components/objective-forms";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type WorkflowStatus =
  | "GENERATING_PLANS"
  | "AWAITING_PLAN_APPROVAL"
  | "RUNNING_AGENT"
  | "EVALUATING"
  | "AWAITING_DECISION_APPROVAL"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

type WorkflowData = {
  id: string;
  status: WorkflowStatus;
  model: string;
  errorMessage: string | null;
  recommendedPlanId: string | null;
  recommendedRationale: string | null;
  agentRun: {
    id: string;
    status: string;
    pullRequestUrl: string | null;
    pullRequestNumber: number | null;
    errorMessage: string | null;
  } | null;
  recommendedPlan: { id: string; title: string } | null;
  plans: Array<{
    id: string;
    title: string;
    description: string;
    approach: string;
    status: string;
  }>;
};

const TERMINAL: WorkflowStatus[] = ["COMPLETED", "FAILED", "CANCELLED"];

const STATUS_LABELS: Record<WorkflowStatus, string> = {
  GENERATING_PLANS: "Generating plans...",
  AWAITING_PLAN_APPROVAL: "Review generated plans",
  RUNNING_AGENT: "Running agent on best plan",
  EVALUATING: "Evaluating results",
  AWAITING_DECISION_APPROVAL: "Review decision recommendation",
  COMPLETED: "Workflow completed",
  FAILED: "Workflow failed",
  CANCELLED: "Workflow cancelled",
};

export function ObjectiveWorkflowPanel({
  objectiveId,
  demoMode,
  hasDecision,
}: {
  objectiveId: string;
  demoMode?: boolean;
  hasDecision: boolean;
}) {
  const router = useRouter();
  const [workflow, setWorkflow] = useState<WorkflowData | null>(null);
  const [model, setModel] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rationale, setRationale] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchWorkflow = useCallback(async () => {
    const res = await fetch(`/api/objectives/${objectiveId}/workflow`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data) return null;
    setWorkflow(data);
    if (data.recommendedRationale && !rationale) {
      setRationale(data.recommendedRationale);
    }
    return data as WorkflowData;
  }, [objectiveId, rationale]);

  useEffect(() => {
    fetch("/api/models")
      .then((res) => res.json())
      .then((data) => {
        setAvailableModels(data);
        if (data.length > 0) setModel(data[0]);
      });

    fetchWorkflow();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchWorkflow]);

  useEffect(() => {
    if (!workflow || TERMINAL.includes(workflow.status)) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(() => {
      fetchWorkflow().then((data) => {
        if (data && TERMINAL.includes(data.status)) {
          router.refresh();
        }
      });
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [workflow?.status, fetchWorkflow, router]);

  async function handleStart() {
    if (!model) return;
    setLoading(true);
    setError("");

    const res = await fetch(`/api/objectives/${objectiveId}/workflow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to start workflow");
      setLoading(false);
      return;
    }

    await fetchWorkflow();
    setLoading(false);
    router.refresh();
  }

  async function handleApprovePlans() {
    setLoading(true);
    setError("");

    const res = await fetch(
      `/api/objectives/${objectiveId}/workflow/approve-plans`,
      { method: "POST" }
    );

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to approve plans");
      setLoading(false);
      return;
    }

    await fetchWorkflow();
    setLoading(false);
    router.refresh();
  }

  async function handleApproveDecision() {
    setLoading(true);
    setError("");

    const res = await fetch(
      `/api/objectives/${objectiveId}/workflow/approve-decision`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rationale: rationale || workflow?.recommendedRationale,
          selectedPlanId: workflow?.recommendedPlanId,
        }),
      }
    );

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to approve decision");
      setLoading(false);
      return;
    }

    await fetchWorkflow();
    setLoading(false);
    router.refresh();
  }

  async function handleCancel() {
    setLoading(true);
    setError("");

    const res = await fetch(
      `/api/objectives/${objectiveId}/workflow/cancel`,
      { method: "POST" }
    );

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to cancel workflow");
      setLoading(false);
      return;
    }

    await fetchWorkflow();
    setLoading(false);
  }

  if (demoMode || hasDecision) {
    return null;
  }

  const active = workflow && !TERMINAL.includes(workflow.status);
  const idle = !workflow || workflow.status === "CANCELLED" || workflow.status === "FAILED";

  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">AI-Assisted Workflow</h3>
        {workflow && (
          <StatusBadge value={workflow.status} />
        )}
      </div>
      <p className="text-sm text-zinc-500">
        Define your objective, then let AI generate plans, run the best approach,
        evaluate results, and recommend a decision. You approve at key steps.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {workflow?.errorMessage && (
        <p className="text-sm text-red-600">{workflow.errorMessage}</p>
      )}

      {workflow && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {STATUS_LABELS[workflow.status]}
        </p>
      )}

      {idle && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger>
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            onClick={handleStart}
            disabled={loading || !model}
          >
            {loading ? "Starting..." : "Start AI Workflow"}
          </Button>
        </div>
      )}

      {workflow?.status === "AWAITING_PLAN_APPROVAL" && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            {workflow.plans.map((plan, index) => (
              <div
                key={plan.id}
                className="space-y-2 rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">
                    Plan {String.fromCharCode(65 + index)}: {plan.title}
                  </p>
                  <EditPlanDialog
                    plan={{
                      id: plan.id,
                      title: plan.title,
                      description: plan.description,
                      approach: plan.approach,
                      status: plan.status,
                    }}
                  />
                </div>
                <p>{plan.description}</p>
                <p className="text-zinc-500">{plan.approach}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={handleApprovePlans}
              disabled={loading}
            >
              {loading ? "Continuing..." : "Approve & Continue"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {(workflow?.status === "RUNNING_AGENT" ||
        workflow?.status === "EVALUATING" ||
        workflow?.status === "GENERATING_PLANS") &&
        active && (
          <div className="flex flex-wrap items-center gap-2">
            {workflow.agentRun && (
              <div className="flex items-center gap-2 text-sm">
                <span>Agent:</span>
                <StatusBadge value={workflow.agentRun.status} />
                {workflow.agentRun.pullRequestUrl && (
                  <a
                    href={workflow.agentRun.pullRequestUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    PR #{workflow.agentRun.pullRequestNumber}
                  </a>
                )}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        )}

      {workflow?.status === "AWAITING_DECISION_APPROVAL" && (
        <div className="space-y-3">
          {workflow.recommendedPlan && (
            <p className="text-sm font-medium">
              Recommended plan: {workflow.recommendedPlan.title}
            </p>
          )}
          <div className="space-y-2">
            <Label>Rationale</Label>
            <Textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={4}
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={handleApproveDecision}
              disabled={loading || !rationale}
            >
              {loading ? "Recording..." : "Approve Decision"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {workflow?.status === "COMPLETED" && (
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/knowledge-graph/${objectiveId}`}>
              View Knowledge Graph
            </Link>
          </Button>
        </div>
      )}

      {workflow?.status === "FAILED" && (
        <Button type="button" onClick={handleStart} disabled={loading || !model}>
          Retry Workflow
        </Button>
      )}
    </div>
  );
}
