import {
  badRequest,
  demoReadonly,
  getSessionUser,
  notFound,
  requireObjectiveAccess,
  unauthorized,
} from "@/lib/api";
import {
  buildAgentBranchName,
  buildAgentPrompt,
} from "@/lib/ai/agent-executor";
import { enqueueExecuteAgentRun } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";
import { executeAgentRunSchema } from "@/lib/validations";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const readonly = demoReadonly();
  if (readonly) return readonly;

  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const access = await requireObjectiveAccess(id, user.id);
  if (!access) return notFound();

  const body = await request.json();
  const parsed = executeAgentRunSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid agent execution request");
  }

  const plan = await prisma.plan.findFirst({
    where: {
      id: parsed.data.planId,
      objectiveId: id,
    },
  });

  if (!plan) {
    return badRequest("Plan not found for this objective");
  }

  const objective = await prisma.objective.findUnique({
    where: { id },
    include: { repository: true },
  });

  if (!objective) {
    return notFound();
  }

  const branchName = buildAgentBranchName(plan.title);
  const prompt = buildAgentPrompt({
    objectiveTitle: objective.title,
    objectiveDescription: objective.description,
    planTitle: plan.title,
    planDescription: plan.description,
    planApproach: plan.approach,
    repositoryFullName: objective.repository.fullName,
    branchName,
  });

  const agentRun = await prisma.agentRun.create({
    data: {
      objectiveId: id,
      planId: plan.id,
      agentName: parsed.data.agentName ?? "IntentHub Agent",
      model: parsed.data.model,
      prompt,
      output: "",
      branchName,
      status: "PENDING",
      createdById: user.id,
    },
  });

  try {
    const handle = await enqueueExecuteAgentRun(agentRun.id);

    return NextResponse.json(
      {
        ...agentRun,
        queued: Boolean(handle),
        runId: handle?.id,
      },
      { status: handle ? 202 : 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start agent run";

    await prisma.agentRun.update({
      where: { id: agentRun.id },
      data: {
        status: "FAILED",
        errorMessage: message,
      },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
