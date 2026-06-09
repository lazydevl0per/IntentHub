import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function getSessionUser() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }
  return session.user;
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export async function requireRepoAccess(repositoryId: string, userId: string) {
  const member = await prisma.repositoryMember.findUnique({
    where: {
      userId_repositoryId: {
        userId,
        repositoryId,
      },
    },
    include: {
      repository: true,
    },
  });

  return member;
}

export async function requireObjectiveAccess(objectiveId: string, userId: string) {
  const objective = await prisma.objective.findUnique({
    where: { id: objectiveId },
    include: {
      repository: {
        include: {
          members: {
            where: { userId },
          },
        },
      },
    },
  });

  if (!objective || objective.repository.members.length === 0) {
    return null;
  }

  return objective;
}
