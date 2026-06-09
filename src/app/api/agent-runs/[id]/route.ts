import {
  getSessionUser,
  notFound,
  unauthorized,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

async function getAgentRunWithAccess(agentRunId: string, userId: string) {
  return prisma.agentRun.findUnique({
    where: { id: agentRunId },
    include: {
      plan: true,
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const agentRun = await getAgentRunWithAccess(id, user.id);

  if (!agentRun || agentRun.objective.repository.members.length === 0) {
    return notFound();
  }

  return NextResponse.json(agentRun);
}
