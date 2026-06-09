import {
  badRequest,
  getSessionUser,
  notFound,
  requireObjectiveAccess,
  unauthorized,
} from "@/lib/api";
import { indexAgentRun } from "@/lib/indexing";
import { prisma } from "@/lib/prisma";
import { agentRunSchema } from "@/lib/validations";
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
  const parsed = agentRunSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid agent run data");
  }

  const agentRun = await prisma.agentRun.create({
    data: {
      objectiveId: id,
      planId: parsed.data.planId,
      agentName: parsed.data.agentName,
      model: parsed.data.model,
      prompt: parsed.data.prompt,
      output: parsed.data.output,
      branchName: parsed.data.branchName,
      status: parsed.data.status,
      createdById: user.id,
    },
  });

  try {
    await indexAgentRun(agentRun.id);
  } catch {
  }

  return NextResponse.json(agentRun, { status: 201 });
}
