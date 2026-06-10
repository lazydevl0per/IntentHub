import {
  getSessionUser,
  notFound,
  requireObjectiveAccess,
  unauthorized,
} from "@/lib/api";
import { getDemoGraphData } from "@/lib/demo/fixtures";
import { isDemoMode } from "@/lib/demo";
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

  if (isDemoMode()) {
    const graph = getDemoGraphData(id);
    if (!graph) return notFound();
    return NextResponse.json(graph);
  }

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
      deployments: {
        orderBy: { deployedAt: "desc" },
        take: 5,
      },
    },
  });

  if (!objective) return notFound();

  const nodes: Array<{
    id: string;
    type: string;
    label: string;
    href?: string;
    data?: Record<string, unknown>;
  }> = [];
  const edges: Array<{ id: string; source: string; target: string }> = [];

  nodes.push({
    id: `objective-${objective.id}`,
    type: "objective",
    label: objective.title,
    href: `/objectives/${objective.id}`,
    data: { status: objective.status },
  });

  for (const plan of objective.plans) {
    nodes.push({
      id: `plan-${plan.id}`,
      type: "plan",
      label: plan.title,
      href: `/objectives/${objective.id}`,
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
      href: `/objectives/${objective.id}`,
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
      href: `/objectives/${objective.id}`,
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
      href: `/objectives/${objective.id}`,
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
          href: `/repositories/${objective.repositoryId}`,
          data: { message: commit.message },
        });
        edges.push({
          id: `edge-decision-commit-${commit.id}`,
          source: `decision-${objective.decision.id}`,
          target: `commit-${commit.id}`,
        });

        const deployment = objective.deployments.find((item) =>
          item.commitSha.startsWith(commit.sha.slice(0, 7))
        );

        if (deployment) {
          nodes.push({
            id: `deployment-${deployment.id}`,
            type: "deployment",
            label: deployment.environment,
            data: { commitSha: deployment.commitSha },
          });
          edges.push({
            id: `edge-commit-deployment-${deployment.id}`,
            source: `commit-${commit.id}`,
            target: `deployment-${deployment.id}`,
          });
        }
      }
    }
  }

  for (const deployment of objective.deployments) {
    if (nodes.some((node) => node.id === `deployment-${deployment.id}`)) {
      continue;
    }

    nodes.push({
      id: `deployment-${deployment.id}`,
      type: "deployment",
      label: deployment.environment,
      data: { commitSha: deployment.commitSha },
    });

    const commit = objective.repository.commits.find((item) =>
      item.sha.startsWith(deployment.commitSha.slice(0, 7))
    );

    if (commit) {
      if (!nodes.some((node) => node.id === `commit-${commit.id}`)) {
        nodes.push({
          id: `commit-${commit.id}`,
          type: "commit",
          label: commit.sha.slice(0, 7),
          href: `/repositories/${objective.repositoryId}`,
          data: { message: commit.message },
        });
      }

      edges.push({
        id: `edge-commit-deployment-${deployment.id}`,
        source: `commit-${commit.id}`,
        target: `deployment-${deployment.id}`,
      });
    } else {
      edges.push({
        id: `edge-objective-deployment-${deployment.id}`,
        source: `objective-${objective.id}`,
        target: `deployment-${deployment.id}`,
      });
    }
  }

  return NextResponse.json({ nodes, edges });
}
