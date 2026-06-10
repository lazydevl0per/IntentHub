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
  demoMode,
}: {
  repositoryId: string;
  demoMode?: boolean;
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

  if (demoMode) {
    return (
      <Button disabled title="Demo mode — read only">
        New Objective
      </Button>
    );
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

export function CreatePlanForm({
  objectiveId,
  demoMode,
}: {
  objectiveId: string;
  demoMode?: boolean;
}) {
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

  if (demoMode) return null;

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
  demoMode,
}: {
  objectiveId: string;
  plans: Array<{ id: string; title: string }>;
  demoMode?: boolean;
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

  if (demoMode) return null;

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
  demoMode,
}: {
  objectiveId: string;
  plans: Array<{ id: string; title: string }>;
  agentRuns: Array<{ id: string; agentName: string }>;
  demoMode?: boolean;
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

  if (demoMode) return null;

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
  demoMode,
  hasExistingDecision,
}: {
  objectiveId: string;
  plans: Array<{ id: string; title: string }>;
  commits: Array<{ sha: string; message: string }>;
  demoMode?: boolean;
  hasExistingDecision?: boolean;
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

  if (demoMode) return null;

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h4 className="font-medium">
        {hasExistingDecision ? "Revise Decision" : "Record Decision"}
      </h4>
      {hasExistingDecision && (
        <p className="text-sm text-zinc-500">
          Switch the winning plan after exploring an alternative. Leave commit
          blank to auto-link the merged pull request for the selected plan.
        </p>
      )}
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
      <Select
        value={linkedCommitSha || "__none__"}
        onValueChange={(value) =>
          setLinkedCommitSha(value === "__none__" ? "" : value)
        }
      >
        <SelectTrigger>
          <SelectValue placeholder="Link commit (optional)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">No linked commit</SelectItem>
          {commits.map((commit) => (
            <SelectItem key={commit.sha} value={commit.sha}>
              {commit.sha.slice(0, 7)} — {commit.message.split("\n")[0].slice(0, 60)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" disabled={loading || !selectedPlanId}>
        {loading
          ? "Saving..."
          : hasExistingDecision
            ? "Update Decision"
            : "Record Decision"}
      </Button>
    </form>
  );
}

export function EditObjectiveDialog({
  objective,
  demoMode,
}: {
  objective: {
    id: string;
    title: string;
    description: string;
    status: string;
    priority: string;
  };
  demoMode?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(objective.title);
  const [description, setDescription] = useState(objective.description);
  const [status, setStatus] = useState(objective.status);
  const [priority, setPriority] = useState(objective.priority);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch(`/api/objectives/${objective.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, status, priority }),
    });

    if (res.ok) {
      setOpen(false);
      router.refresh();
    }

    setLoading(false);
  }

  async function handleDelete() {
    if (!window.confirm("Delete this objective and all related data?")) {
      return;
    }

    setLoading(true);

    const res = await fetch(`/api/objectives/${objective.id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      router.push("/");
      router.refresh();
    }

    setLoading(false);
  }

  if (demoMode) {
    return (
      <Button variant="outline" size="sm" disabled title="Demo mode — read only">
        Edit Objective
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Edit Objective
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Objective</DialogTitle>
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
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">DRAFT</SelectItem>
                <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                <SelectItem value="COMPLETED">COMPLETED</SelectItem>
                <SelectItem value="ARCHIVED">ARCHIVED</SelectItem>
              </SelectContent>
            </Select>
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
          <div className="flex justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-red-300 text-red-700 dark:border-red-900 dark:text-red-400"
              onClick={handleDelete}
              disabled={loading}
            >
              Delete
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditPlanDialog({
  plan,
  demoMode,
}: {
  plan: {
    id: string;
    title: string;
    description: string;
    approach: string;
    status: string;
  };
  demoMode?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(plan.title);
  const [description, setDescription] = useState(plan.description);
  const [approach, setApproach] = useState(plan.approach);
  const [status, setStatus] = useState(plan.status);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch(`/api/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, approach, status }),
    });

    if (res.ok) {
      setOpen(false);
      router.refresh();
    }

    setLoading(false);
  }

  async function handleDelete() {
    if (!window.confirm("Delete this plan?")) {
      return;
    }

    setLoading(true);

    const res = await fetch(`/api/plans/${plan.id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      setOpen(false);
      router.refresh();
    }

    setLoading(false);
  }

  if (demoMode) {
    return (
      <Button variant="ghost" size="sm" disabled title="Demo mode — read only">
        Edit
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Plan</DialogTitle>
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
            <Label>Approach</Label>
            <Textarea value={approach} onChange={(e) => setApproach(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">DRAFT</SelectItem>
                <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                <SelectItem value="REJECTED">REJECTED</SelectItem>
                <SelectItem value="SELECTED">SELECTED</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-red-300 text-red-700 dark:border-red-900 dark:text-red-400"
              onClick={handleDelete}
              disabled={loading}
            >
              Delete
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
