import {
  badRequest,
  demoReadonly,
  getSessionUser,
  notFound,
  unauthorized,
} from "@/lib/api";
import { enqueueIndexEntity } from "@/lib/jobs";
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
  const readonly = demoReadonly();
  if (readonly) return readonly;

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
    await enqueueIndexEntity({ entity: "plan", id: updated.id });
  } catch (error) {
    console.error("[index] plan indexing enqueue failed", {
      planId: updated.id,
      error: error instanceof Error ? error.message : error,
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const readonly = demoReadonly();
  if (readonly) return readonly;

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
