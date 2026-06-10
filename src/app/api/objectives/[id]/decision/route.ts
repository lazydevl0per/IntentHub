import {
  badRequest,
  demoReadonly,
  getSessionUser,
  notFound,
  requireObjectiveAccess,
  unauthorized,
} from "@/lib/api";
import { recordDecision } from "@/lib/decision";
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

  const decision = await recordDecision({
    objectiveId: id,
    selectedPlanId: parsed.data.selectedPlanId,
    rationale: parsed.data.rationale,
    linkedCommitSha: parsed.data.linkedCommitSha,
    approvedById: user.id,
  });

  return NextResponse.json(decision, { status: 201 });
}
