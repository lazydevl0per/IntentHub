import {
  badRequest,
  getSessionUser,
  notFound,
  requireObjectiveAccess,
  unauthorized,
} from "@/lib/api";
import { indexEvaluation } from "@/lib/indexing";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { evaluationSchema } from "@/lib/validations";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    await indexEvaluation(evaluation.id);
  } catch {
  }

  return NextResponse.json(evaluation, { status: 201 });
}
