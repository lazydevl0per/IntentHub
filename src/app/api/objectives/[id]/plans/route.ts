import {
  badRequest,
  getSessionUser,
  notFound,
  requireObjectiveAccess,
  unauthorized,
} from "@/lib/api";
import { indexPlan } from "@/lib/indexing";
import { prisma } from "@/lib/prisma";
import { planSchema } from "@/lib/validations";
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
  const parsed = planSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid plan data");
  }

  const plan = await prisma.plan.create({
    data: {
      objectiveId: id,
      title: parsed.data.title,
      description: parsed.data.description,
      approach: parsed.data.approach,
      status: parsed.data.status,
      createdById: user.id,
    },
  });

  try {
    await indexPlan(plan.id);
  } catch {
  }

  return NextResponse.json(plan, { status: 201 });
}
