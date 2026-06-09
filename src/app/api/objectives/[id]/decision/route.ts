import {
  badRequest,
  getSessionUser,
  notFound,
  requireObjectiveAccess,
  unauthorized,
} from "@/lib/api";
import { indexDecision } from "@/lib/indexing";
import { prisma } from "@/lib/prisma";
import { decisionSchema } from "@/lib/validations";
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

  try {
    await indexDecision(id);
  } catch {
  }

  return NextResponse.json(decision, { status: 201 });
}
