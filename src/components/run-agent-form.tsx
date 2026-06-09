"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function RunAgentForm({
  objectiveId,
  plans,
}: {
  objectiveId: string;
  plans: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();
  const [planId, setPlanId] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRun() {
    if (!planId) return;

    setLoading(true);
    setError("");

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

    setLoading(false);
    router.refresh();
  }

  if (plans.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h4 className="font-medium">Run Agent on Plan</h4>
      <p className="text-sm text-zinc-500">
        Creates a Git branch and generates an implementation report using AI.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
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
        {loading ? "Starting..." : "Run Agent"}
      </Button>
    </div>
  );
}

export function RunAgentButton({
  objectiveId,
  planId,
}: {
  objectiveId: string;
  planId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRun() {
    setLoading(true);

    await fetch(`/api/objectives/${objectiveId}/agent-runs/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, model: "gpt-4o-mini" }),
    });

    setLoading(false);
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleRun}
      disabled={loading}
    >
      {loading ? "Starting..." : "Run Agent"}
    </Button>
  );
}
