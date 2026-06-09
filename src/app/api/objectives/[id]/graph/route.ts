import {
  getSessionUser,
  notFound,
  requireObjectiveAccess,
  unauthorized,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const access = await requireObjectiveAccess(id, user.id);
  if (!access) return notFound();

  const objective = await prisma.objective.findUnique({
    where: { id },
    include: {
      plans: true,
      agentRuns: true,
      evaluations: true,
      decision: true,
      repository: {
        include: {
          commits: {
            take: 10,
            orderBy: { committedAt: "desc" },
          },
        },
      },
    },
  });

  if (!objective) return notFound();

  const nodes: Array<{
    id: string;
    type: string;
    label: string;
    data?: Record<string, unknown>;
  }> = [];
  const edges: Array<{ id: string; source: string; target: string }> = [];

  nodes.push({
    id: `objective-${objective.id}`,
    type: "objective",
    label: objective.title,
    data: { status: objective.status },
  });

  for (const plan of objective.plans) {
    nodes.push({
      id: `plan-${plan.id}`,
      type: "plan",
      label: plan.title,
      data: { status: plan.status },
    });
    edges.push({
      id: `edge-objective-plan-${plan.id}`,
      source: `objective-${objective.id}`,
      target: `plan-${plan.id}`,
    });
  }

  for (const run of objective.agentRuns) {
    nodes.push({
      id: `run-${run.id}`,
      type: "agentRun",
      label: run.agentName,
      data: { status: run.status, model: run.model },
    });

    const source = run.planId
      ? `plan-${run.planId}`
      : `objective-${objective.id}`;

    edges.push({
      id: `edge-run-${run.id}`,
      source,
      target: `run-${run.id}`,
    });
  }

  for (const evaluation of objective.evaluations) {
    nodes.push({
      id: `eval-${evaluation.id}`,
      type: "evaluation",
      label: `${evaluation.type} (${evaluation.score})`,
      data: { type: evaluation.type, score: evaluation.score },
    });

    const source = evaluation.agentRunId
      ? `run-${evaluation.agentRunId}`
      : evaluation.planId
        ? `plan-${evaluation.planId}`
        : `objective-${objective.id}`;

    edges.push({
      id: `edge-eval-${evaluation.id}`,
      source,
      target: `eval-${evaluation.id}`,
    });
  }

  if (objective.decision) {
    nodes.push({
      id: `decision-${objective.decision.id}`,
      type: "decision",
      label: "Decision",
      data: { rationale: objective.decision.rationale },
    });
    edges.push({
      id: `edge-decision-plan-${objective.decision.selectedPlanId}`,
      source: `plan-${objective.decision.selectedPlanId}`,
      target: `decision-${objective.decision.id}`,
    });

    if (objective.decision.linkedCommitSha) {
      const commit = objective.repository.commits.find(
        (c) => c.sha.startsWith(objective.decision!.linkedCommitSha!)
      );

      if (commit) {
        nodes.push({
          id: `commit-${commit.id}`,
          type: "commit",
          label: commit.sha.slice(0, 7),
          data: { message: commit.message },
        });
        edges.push({
          id: `edge-decision-commit-${commit.id}`,
          source: `decision-${objective.decision.id}`,
          target: `commit-${commit.id}`,
        });
      }
    }
  }

  return NextResponse.json({ nodes, edges });
}
