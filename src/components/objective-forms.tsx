"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function CreateObjectiveDialog({
  repositoryId,
}: {
  repositoryId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch(`/api/repositories/${repositoryId}/objectives`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        status: "ACTIVE",
        priority,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setOpen(false);
      router.push(`/objectives/${data.id}`);
      router.refresh();
    }

    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New Objective</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Objective</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">LOW</SelectItem>
                <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                <SelectItem value="HIGH">HIGH</SelectItem>
                <SelectItem value="CRITICAL">CRITICAL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Objective"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreatePlanForm({ objectiveId }: { objectiveId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [approach, setApproach] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    await fetch(`/api/objectives/${objectiveId}/plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, approach }),
    });

    setTitle("");
    setDescription("");
    setApproach("");
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h4 className="font-medium">Add Plan</h4>
      <Input placeholder="Plan title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <Textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} required />
      <Textarea placeholder="Approach" value={approach} onChange={(e) => setApproach(e.target.value)} required />
      <Button type="submit" size="sm" disabled={loading}>
        Add Plan
      </Button>
    </form>
  );
}

export function CreateAgentRunForm({
  objectiveId,
  plans,
}: {
  objectiveId: string;
  plans: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();
  const [planId, setPlanId] = useState("");
  const [agentName, setAgentName] = useState("");
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [branchName, setBranchName] = useState("");
  const [status, setStatus] = useState("COMPLETED");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    await fetch(`/api/objectives/${objectiveId}/agent-runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId: planId || undefined,
        agentName,
        model,
        prompt,
        output,
        branchName,
        status,
      }),
    });

    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h4 className="font-medium">Record Agent Run</h4>
      <Select value={planId} onValueChange={setPlanId}>
        <SelectTrigger>
          <SelectValue placeholder="Link to plan (optional)" />
        </SelectTrigger>
        <SelectContent>
          {plans.map((plan) => (
            <SelectItem key={plan.id} value={plan.id}>
              {plan.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input placeholder="Agent name" value={agentName} onChange={(e) => setAgentName(e.target.value)} required />
      <Input placeholder="Model" value={model} onChange={(e) => setModel(e.target.value)} />
      <Textarea placeholder="Prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} required />
      <Textarea placeholder="Output" value={output} onChange={(e) => setOutput(e.target.value)} required />
      <Input placeholder="Branch name" value={branchName} onChange={(e) => setBranchName(e.target.value)} />
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="PENDING">PENDING</SelectItem>
          <SelectItem value="RUNNING">RUNNING</SelectItem>
          <SelectItem value="COMPLETED">COMPLETED</SelectItem>
          <SelectItem value="FAILED">FAILED</SelectItem>
        </SelectContent>
      </Select>
      <Button type="submit" size="sm" disabled={loading}>
        Record Run
      </Button>
    </form>
  );
}

export function CreateEvaluationForm({
  objectiveId,
  plans,
  agentRuns,
}: {
  objectiveId: string;
  plans: Array<{ id: string; title: string }>;
  agentRuns: Array<{ id: string; agentName: string }>;
}) {
  const router = useRouter();
  const [type, setType] = useState("TEST");
  const [score, setScore] = useState("80");
  const [summary, setSummary] = useState("");
  const [planId, setPlanId] = useState("");
  const [agentRunId, setAgentRunId] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    await fetch(`/api/objectives/${objectiveId}/evaluations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        score: Number(score),
        summary,
        planId: planId || undefined,
        agentRunId: agentRunId || undefined,
      }),
    });

    setSummary("");
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h4 className="font-medium">Add Evaluation</h4>
      <Select value={type} onValueChange={setType}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="TEST">TEST</SelectItem>
          <SelectItem value="BENCHMARK">BENCHMARK</SelectItem>
          <SelectItem value="SECURITY">SECURITY</SelectItem>
          <SelectItem value="QUALITY">QUALITY</SelectItem>
        </SelectContent>
      </Select>
      <Input type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} />
      <Textarea placeholder="Summary" value={summary} onChange={(e) => setSummary(e.target.value)} required />
      <Select value={planId} onValueChange={setPlanId}>
        <SelectTrigger>
          <SelectValue placeholder="Link to plan (optional)" />
        </SelectTrigger>
        <SelectContent>
          {plans.map((plan) => (
            <SelectItem key={plan.id} value={plan.id}>
              {plan.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={agentRunId} onValueChange={setAgentRunId}>
        <SelectTrigger>
          <SelectValue placeholder="Link to agent run (optional)" />
        </SelectTrigger>
        <SelectContent>
          {agentRuns.map((run) => (
            <SelectItem key={run.id} value={run.id}>
              {run.agentName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" size="sm" disabled={loading}>
        Add Evaluation
      </Button>
    </form>
  );
}

export function CreateDecisionForm({
  objectiveId,
  plans,
  commits,
}: {
  objectiveId: string;
  plans: Array<{ id: string; title: string }>;
  commits: Array<{ sha: string; message: string }>;
}) {
  const router = useRouter();
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [rationale, setRationale] = useState("");
  const [linkedCommitSha, setLinkedCommitSha] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    await fetch(`/api/objectives/${objectiveId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectedPlanId,
        rationale,
        linkedCommitSha: linkedCommitSha || undefined,
      }),
    });

    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h4 className="font-medium">Record Decision</h4>
      <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
        <SelectTrigger>
          <SelectValue placeholder="Select winning plan" />
        </SelectTrigger>
        <SelectContent>
          {plans.map((plan) => (
            <SelectItem key={plan.id} value={plan.id}>
              {plan.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Textarea placeholder="Rationale" value={rationale} onChange={(e) => setRationale(e.target.value)} required />
      <Select value={linkedCommitSha} onValueChange={setLinkedCommitSha}>
        <SelectTrigger>
          <SelectValue placeholder="Link commit (optional)" />
        </SelectTrigger>
        <SelectContent>
          {commits.map((commit) => (
            <SelectItem key={commit.sha} value={commit.sha}>
              {commit.sha.slice(0, 7)} — {commit.message.slice(0, 40)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" disabled={loading || !selectedPlanId}>
        Record Decision
      </Button>
    </form>
  );
}
