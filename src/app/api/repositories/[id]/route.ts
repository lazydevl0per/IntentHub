import {
  getSessionUser,
  notFound,
  requireRepoAccess,
  unauthorized,
} from "@/lib/api";
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
