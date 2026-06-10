"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isExploratoryPlanRun } from "@/components/completed-objective-panel";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AgentRunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

async function pollAgentRun(agentRunId: string): Promise<AgentRunStatus> {
  const res = await fetch(`/api/agent-runs/${agentRunId}`);
  if (!res.ok) throw new Error("Failed to fetch agent run status");
  const data = await res.json();
  return data.status as AgentRunStatus;
}

function ExploratoryRunFollowUp({ planTitle }: { planTitle: string }) {
  return (
    <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
      <p className="font-medium">Alternative run finished</p>
      <p className="mt-1">
        <span className="font-medium">{planTitle}</span> was explored without
        changing the recorded decision. Review the pull request, add an
        evaluation on the Evaluations tab, and use Revise Decision if you want
        to switch the winning plan.
      </p>
    </div>
  );
}

export function RunAgentButton({
  objectiveId,
  planId,
  planTitle,
  planStatus,
  objectiveStatus,
  selectedPlanId,
  hasDecision,
  demoMode,
}: {
  objectiveId: string;
  planId: string;
  planTitle: string;
  planStatus: string;
  objectiveStatus: string;
  selectedPlanId?: string | null;
  hasDecision?: boolean;
  demoMode?: boolean;
}) {
  const router = useRouter();
  const [model, setModel] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const exploratory = isExploratoryPlanRun({
    objectiveStatus,
    hasDecision: Boolean(hasDecision),
    planId,
    planStatus,
    selectedPlanId,
  });

  useEffect(() => {
    fetch("/api/models")
      .then((res) => res.json())
      .then((data) => {
        if (data.length > 0) setModel(data[0]);
      });
  }, []);

  async function executeRun() {
    if (!model) return;
    setLoading(true);

    const res = await fetch(
      `/api/objectives/${objectiveId}/agent-runs/execute`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, model }),
      }
    );

    if (res.ok) {
      router.refresh();
    }

    setLoading(false);
    setConfirmOpen(false);
  }

  function handleRunClick() {
    if (exploratory) {
      setConfirmOpen(true);
      return;
    }

    void executeRun();
  }

  if (demoMode) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleRunClick}
        disabled={loading || !model}
      >
        {loading ? "..." : exploratory ? "Explore" : "Run"}
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Explore rejected plan?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p>
              This objective is already complete. Running{" "}
              <span className="font-medium">{planTitle}</span> creates an
              exploratory branch and pull request only.
            </p>
            <p className="text-zinc-500">
              The recorded decision will not change automatically. After
              reviewing or merging the PR, add an evaluation and use Revise
              Decision if you want to switch plans.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void executeRun()}
                disabled={loading || !model}
              >
                {loading ? "Starting..." : "Start exploration"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RunAgentForm({
  objectiveId,
  plans,
  objectiveStatus,
  selectedPlanId,
  hasDecision,
  demoMode,
}: {
  objectiveId: string;
  plans: Array<{ id: string; title: string; status: string }>;
  objectiveStatus: string;
  selectedPlanId?: string | null;
  hasDecision?: boolean;
  demoMode?: boolean;
}) {
  const router = useRouter();
  const [planId, setPlanId] = useState("");
  const [model, setModel] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<AgentRunStatus | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [followUpPlanTitle, setFollowUpPlanTitle] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedPlan = plans.find((plan) => plan.id === planId);
  const exploratory = selectedPlan
    ? isExploratoryPlanRun({
        objectiveStatus,
        hasDecision: Boolean(hasDecision),
        planId: selectedPlan.id,
        planStatus: selectedPlan.status,
        selectedPlanId,
      })
    : false;

  useEffect(() => {
    fetch("/api/models")
      .then((res) => res.json())
      .then((data) => {
        setAvailableModels(data);
        if (data.length > 0) setModel(data[0]);
      });

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function startPolling(agentRunId: string, planTitle: string, exploratoryRun: boolean) {
    setActiveRunId(agentRunId);
    setRunStatus("PENDING");
    setShowFollowUp(false);

    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const status = await pollAgentRun(agentRunId);
        setRunStatus(status);

        if (status === "COMPLETED" || status === "FAILED") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setLoading(false);
          if (status === "COMPLETED" && exploratoryRun) {
            setFollowUpPlanTitle(planTitle);
            setShowFollowUp(true);
          }
          router.refresh();
        }
      } catch {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setLoading(false);
        setError("Lost connection while tracking agent run");
      }
    }, 3000);
  }

  async function executeRun() {
    if (!planId || !model || !selectedPlan) return;

    setLoading(true);
    setError("");
    setRunStatus(null);
    setActiveRunId(null);
    setShowFollowUp(false);

    const res = await fetch(
      `/api/objectives/${objectiveId}/agent-runs/execute`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, model }),
      }
    );

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to start agent run");
      setLoading(false);
      setConfirmOpen(false);
      return;
    }

    const data = await res.json();
    setConfirmOpen(false);
    startPolling(data.id, selectedPlan.title, exploratory);
  }

  function handleRunClick() {
    if (!planId || !model) return;

    if (exploratory) {
      setConfirmOpen(true);
      return;
    }

    void executeRun();
  }

  if (plans.length === 0 || demoMode) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h4 className="font-medium">Run Agent on Plan</h4>
      <p className="text-sm text-zinc-500">
        Creates a Git branch and generates an implementation report using AI.
      </p>
      {objectiveStatus === "COMPLETED" && hasDecision && (
        <p className="text-sm text-amber-800 dark:text-amber-200">
          This objective already has a final decision. Runs on rejected plans
          are exploratory and do not change the decision automatically.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {activeRunId && runStatus && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500">Agent run:</span>
          <StatusBadge value={runStatus} />
        </div>
      )}
      {showFollowUp && followUpPlanTitle && (
        <ExploratoryRunFollowUp planTitle={followUpPlanTitle} />
      )}
      <Select value={planId} onValueChange={setPlanId}>
        <SelectTrigger>
          <SelectValue placeholder="Select plan" />
        </SelectTrigger>
        <SelectContent>
          {plans.map((plan) => (
            <SelectItem key={plan.id} value={plan.id}>
              {plan.title}
              {plan.status === "REJECTED" ? " (rejected)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
      <Button
        type="button"
        size="sm"
        onClick={handleRunClick}
        disabled={loading || !planId || !model}
      >
        {loading ? "Running..." : exploratory ? "Explore plan" : "Run Agent"}
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Explore rejected plan?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p>
              This objective is already complete. Running{" "}
              <span className="font-medium">{selectedPlan?.title}</span> creates
              an exploratory branch and pull request only.
            </p>
            <p className="text-zinc-500">
              The recorded decision will not change automatically. After
              reviewing or merging the PR, add an evaluation and use Revise
              Decision if you want to switch plans.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void executeRun()}
                disabled={loading || !planId || !model}
              >
                {loading ? "Starting..." : "Start exploration"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
