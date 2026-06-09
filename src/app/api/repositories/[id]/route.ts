import {
  getSessionUser,
  notFound,
  requireRepoAccess,
  unauthorized,
} from "@/lib/api";
import { deleteRepositoryWebhook } from "@/lib/github";
import { prisma } from "@/lib/prisma";
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

  const repository = await prisma.repository.findUnique({
    where: { id },
    include: {
      objectives: {
        orderBy: { updatedAt: "desc" },
      },
      commits: {
        orderBy: { committedAt: "desc" },
        take: 20,
      },
      branches: {
        orderBy: { name: "asc" },
      },
      _count: {
        select: {
          objectives: true,
          commits: true,
        },
      },
    },
  });

  return NextResponse.json(repository);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const member = await requireRepoAccess(id, user.id);
  if (!member) return notFound();

  if (member.role !== "OWNER") {
    await prisma.repositoryMember.delete({
      where: {
        userId_repositoryId: { userId: user.id, repositoryId: id },
      },
    });
    return NextResponse.json({ success: true });
  }

  await deleteRepositoryWebhook(id, user.id);

  await prisma.repository.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
