import {
  badRequest,
  getSessionUser,
  notFound,
  requireRepoAccess,
  unauthorized,
} from "@/lib/api";
import { enqueueIndexEntity } from "@/lib/jobs";
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
  const member = await requireRepoAccess(id, user.id);
  if (!member) return notFound();

  const objectives = await prisma.objective.findMany({
    where: { repositoryId: id },
    include: {
      creator: {
        select: { id: true, name: true, email: true },
      },
      decision: true,
      _count: {
        select: { plans: true, agentRuns: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(objectives);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const member = await requireRepoAccess(id, user.id);
  if (!member) return notFound();

  const body = await request.json();
  const parsed = objectiveSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid objective data");
  }

  const objective = await prisma.objective.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      status: parsed.data.status,
      priority: parsed.data.priority,
      repositoryId: id,
      creatorId: user.id,
    },
    include: {
      creator: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  try {
    await enqueueIndexEntity({ entity: "objective", id: objective.id });
  } catch (error) {
    console.error("[index] objective indexing enqueue failed", {
      objectiveId: objective.id,
      error: error instanceof Error ? error.message : error,
    });
  }

  return NextResponse.json(objective, { status: 201 });
}
