import {
  getSessionUser,
  notFound,
  requireRepoAccess,
  unauthorized,
} from "@/lib/api";
import { syncRepository } from "@/lib/github";
import { indexCommit } from "@/lib/indexing";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const member = await requireRepoAccess(id, user.id);
  if (!member) return notFound();

  try {
    await syncRepository(id);

    const commits = await prisma.gitCommit.findMany({
      where: { repositoryId: id },
      take: 20,
      orderBy: { committedAt: "desc" },
    });

    for (const commit of commits) {
      try {
        await indexCommit(id, commit.sha);
      } catch {
      }
    }

    const repository = await prisma.repository.findUnique({
      where: { id },
    });

    return NextResponse.json(repository);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
