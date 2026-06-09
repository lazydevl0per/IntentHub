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
import { Prisma } from "@prisma/client";
import { evaluationSchema } from "@/lib/validations";
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
  const parsed = evaluationSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid evaluation data");
  }

  const evaluation = await prisma.evaluation.create({
    data: {
      objectiveId: id,
      planId: parsed.data.planId,
      agentRunId: parsed.data.agentRunId,
      type: parsed.data.type,
      score: parsed.data.score,
      summary: parsed.data.summary,
      rawJson: parsed.data.rawJson as Prisma.InputJsonValue | undefined,
      createdById: user.id,
    },
  });

  try {
    await enqueueIndexEntity({ entity: "evaluation", id: evaluation.id });
  } catch (error) {
    console.error("[index] evaluation indexing enqueue failed", {
      evaluationId: evaluation.id,
      error: error instanceof Error ? error.message : error,
    });
  }

  return NextResponse.json(evaluation, { status: 201 });
}
