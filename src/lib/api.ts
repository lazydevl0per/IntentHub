import { isDemoMode } from "@/lib/demo";
import {
  getDemoObjectiveAccess,
  getDemoRepositoryMember,
} from "@/lib/demo/fixtures";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function getSessionUser() {
  const session = await getAppSession();
  if (!session?.user?.id) {
    return null;
  }
  return session.user;
}

export function demoReadonly() {
  if (isDemoMode()) {
    return NextResponse.json({ error: "Demo mode is read-only" }, { status: 403 });
  }
  return null;
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
  if (isDemoMode()) {
    const member = getDemoRepositoryMember(repositoryId, userId);
    if (!member) return null;
    return { ...member, repository: { id: repositoryId } };
  }

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
  if (isDemoMode()) {
    return getDemoObjectiveAccess(objectiveId, userId);
  }

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
