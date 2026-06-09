import {
  badRequest,
  getSessionUser,
  notFound,
  unauthorized,
} from "@/lib/api";
import { indexPlan } from "@/lib/indexing";
import { prisma } from "@/lib/prisma";
import { planSchema } from "@/lib/validations";
import { NextResponse } from "next/server";

async function getPlanWithAccess(planId: string, userId: string) {
  return prisma.plan.findUnique({
    where: { id: planId },
    include: {
      objective: {
        include: {
          repository: {
            include: {
              members: {
                where: { userId },
              },
            },
          },
        },
      },
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const plan = await getPlanWithAccess(id, user.id);
  if (!plan || plan.objective.repository.members.length === 0) {
    return notFound();
  }

  const body = await request.json();
  const parsed = planSchema.partial().safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid plan data");
  }

  const updated = await prisma.plan.update({
    where: { id },
    data: parsed.data,
  });

  try {
    await indexPlan(updated.id);
  } catch {
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const plan = await getPlanWithAccess(id, user.id);
  if (!plan || plan.objective.repository.members.length === 0) {
    return notFound();
  }

  await prisma.plan.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
