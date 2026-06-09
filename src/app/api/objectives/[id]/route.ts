import {
  badRequest,
  getSessionUser,
  notFound,
  requireObjectiveAccess,
  unauthorized,
} from "@/lib/api";
import { indexObjective } from "@/lib/indexing";
import { prisma } from "@/lib/prisma";
import { objectiveSchema } from "@/lib/validations";
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
      creator: {
        select: { id: true, name: true, email: true },
      },
      repository: true,
      plans: {
        include: {
          createdBy: {
            select: { id: true, name: true },
          },
          _count: {
            select: { agentRuns: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      agentRuns: {
        include: {
          plan: true,
          createdBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      evaluations: {
        include: {
          plan: true,
          agentRun: true,
          createdBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      decision: {
        include: {
          selectedPlan: true,
          approvedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
  });

  return NextResponse.json(objective);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const access = await requireObjectiveAccess(id, user.id);
  if (!access) return notFound();

  const body = await request.json();
  const parsed = objectiveSchema.partial().safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid objective data");
  }

  const objective = await prisma.objective.update({
    where: { id },
    data: parsed.data,
  });

  try {
    await indexObjective(objective.id);
  } catch {
  }

  return NextResponse.json(objective);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const access = await requireObjectiveAccess(id, user.id);
  if (!access) return notFound();

  await prisma.objective.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
