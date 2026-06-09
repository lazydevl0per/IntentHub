import {
  getSessionUser,
  notFound,
  requireRepoAccess,
  unauthorized,
} from "@/lib/api";
import { getDemoChatSession } from "@/lib/demo/fixtures";
import { isDemoMode } from "@/lib/demo";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id, sessionId } = await params;
  const member = await requireRepoAccess(id, user.id);
  if (!member) return notFound();

  if (isDemoMode()) {
    const session = getDemoChatSession(id, sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    return NextResponse.json(session);
  }

  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, repositoryId: id, userId: user.id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(session);
}
