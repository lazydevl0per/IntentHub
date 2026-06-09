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
import { planSchema } from "@/lib/validations";
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
    await enqueueIndexEntity({ entity: "plan", id: plan.id });
  } catch (error) {
    console.error("[index] plan indexing enqueue failed", {
      planId: plan.id,
      error: error instanceof Error ? error.message : error,
    });
  }

  return NextResponse.json(plan, { status: 201 });
}
