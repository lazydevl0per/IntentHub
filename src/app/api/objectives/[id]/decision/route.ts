import {
  badRequest,
  demoReadonly,
  getSessionUser,
  notFound,
  requireObjectiveAccess,
  unauthorized,
} from "@/lib/api";
import { enqueueIndexEntity, enqueueGenerateObjectiveSummary } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";
import { decisionSchema } from "@/lib/validations";
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
  const parsed = decisionSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid decision data");
  }

  const plan = await prisma.plan.findFirst({
    where: {
      id: parsed.data.selectedPlanId,
      objectiveId: id,
    },
  });

  if (!plan) {
    return badRequest("Selected plan does not belong to this objective");
  }

  const decision = await prisma.decision.upsert({
    where: { objectiveId: id },
    create: {
      objectiveId: id,
      selectedPlanId: parsed.data.selectedPlanId,
      rationale: parsed.data.rationale,
      linkedCommitSha: parsed.data.linkedCommitSha,
      approvedById: user.id,
    },
    update: {
      selectedPlanId: parsed.data.selectedPlanId,
      rationale: parsed.data.rationale,
      linkedCommitSha: parsed.data.linkedCommitSha,
      approvedById: user.id,
      approvedAt: new Date(),
    },
    include: {
      selectedPlan: true,
      approvedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  await prisma.objective.update({
    where: { id },
    data: { status: "COMPLETED" },
  });

  await prisma.plan.update({
    where: { id: parsed.data.selectedPlanId },
    data: { status: "SELECTED" },
  });

  await prisma.plan.updateMany({
    where: {
      objectiveId: id,
      id: { not: parsed.data.selectedPlanId },
    },
    data: { status: "REJECTED" },
  });

  try {
    await enqueueIndexEntity({ entity: "decision", objectiveId: id });
  } catch (error) {
    console.error("[index] decision indexing enqueue failed", {
      objectiveId: id,
      error: error instanceof Error ? error.message : error,
    });
  }

  try {
    await enqueueGenerateObjectiveSummary(id);
  } catch (error) {
    console.error("[summary] objective summary enqueue failed", {
      objectiveId: id,
      error: error instanceof Error ? error.message : error,
    });
  }

  return NextResponse.json(decision, { status: 201 });
}
