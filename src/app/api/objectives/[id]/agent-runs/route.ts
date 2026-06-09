import {
  badRequest,
  demoReadonly,
  getSessionUser,
  notFound,
  requireObjectiveAccess,
  unauthorized,
} from "@/lib/api";
import { enqueueIndexEntity } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";
import { agentRunSchema } from "@/lib/validations";
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
  const parsed = agentRunSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid agent run data");
  }

  const agentRun = await prisma.agentRun.create({
    data: {
      objectiveId: id,
      planId: parsed.data.planId,
      agentName: parsed.data.agentName,
      model: parsed.data.model,
      prompt: parsed.data.prompt,
      output: parsed.data.output,
      branchName: parsed.data.branchName,
      status: parsed.data.status,
      createdById: user.id,
    },
  });

  try {
    await enqueueIndexEntity({ entity: "agent-run", id: agentRun.id });
  } catch (error) {
    console.error("[index] agent run indexing enqueue failed", {
      agentRunId: agentRun.id,
      error: error instanceof Error ? error.message : error,
    });
  }

  return NextResponse.json(agentRun, { status: 201 });
}
