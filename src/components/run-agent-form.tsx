"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";

type AgentRunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

async function pollAgentRun(agentRunId: string): Promise<AgentRunStatus> {
  const res = await fetch(`/api/agent-runs/${agentRunId}`);
  if (!res.ok) throw new Error("Failed to fetch agent run status");
  const data = await res.json();
  return data.status as AgentRunStatus;
}

export function RunAgentForm({
  objectiveId,
  plans,
  demoMode,
}: {
  objectiveId: string;
  plans: Array<{ id: string; title: string }>;
  demoMode?: boolean;
}) {
  const router = useRouter();
  const [planId, setPlanId] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<AgentRunStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function startPolling(agentRunId: string) {
    setActiveRunId(agentRunId);
    setRunStatus("PENDING");

    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const status = await pollAgentRun(agentRunId);
        setRunStatus(status);

        if (status === "COMPLETED" || status === "FAILED") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setLoading(false);
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

  async function handleRun() {
    if (!planId) return;

    setLoading(true);
    setError("");
    setRunStatus(null);
    setActiveRunId(null);

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
      return;
    }

    const data = await res.json();
    startPolling(data.id);
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
      {error && <p className="text-sm text-red-600">{error}</p>}
      {activeRunId && runStatus && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500">Agent run:</span>
          <StatusBadge value={runStatus} />
        </div>
      )}
      <Select value={planId} onValueChange={setPlanId}>
        <SelectTrigger>
          <SelectValue placeholder="Select plan" />
        </SelectTrigger>
        <SelectContent>
          {plans.map((plan) => (
            <SelectItem key={plan.id} value={plan.id}>
              {plan.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={model} onValueChange={setModel}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
          <SelectItem value="gpt-4o">gpt-4o</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        onClick={handleRun}
        disabled={loading || !planId}
      >
        {loading ? "Running..." : "Run Agent"}
      </Button>
    </div>
  );
}

export function RunAgentButton({
  objectiveId,
  planId,
  demoMode,
}: {
  objectiveId: string;
  planId: string;
  demoMode?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRun() {
    setLoading(true);

    const res = await fetch(`/api/objectives/${objectiveId}/agent-runs/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, model: "gpt-4o-mini" }),
    });

    if (res.ok) {
      const data = await res.json();
      const agentRunId = data.id as string;
      const deadline = Date.now() + 120_000;

      while (Date.now() < deadline) {
        const statusRes = await fetch(`/api/agent-runs/${agentRunId}`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (
            statusData.status === "COMPLETED" ||
            statusData.status === "FAILED"
          ) {
            break;
          }
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    setLoading(false);
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleRun}
      disabled={loading || demoMode}
      title={demoMode ? "Demo mode — read only" : undefined}
    >
      {loading ? "Running..." : "Run Agent"}
    </Button>
  );
}
