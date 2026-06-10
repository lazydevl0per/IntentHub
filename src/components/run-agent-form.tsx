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
  const [model, setModel] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/models")
      .then((res) => res.json())
      .then((data) => {
        if (data.length > 0) setModel(data[0]);
      });
  }, []);

  async function handleRun() {
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
  }

  if (demoMode) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleRun}
      disabled={loading || !model}
    >
      {loading ? "..." : "Run"}
    </Button>
  );
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
  const [model, setModel] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<AgentRunStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    if (!planId || !model) return;

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
        onClick={handleRun}
        disabled={loading || !planId || !model}
      >
        {loading ? "Running..." : "Run Agent"}
      </Button>
    </div>
  );
}