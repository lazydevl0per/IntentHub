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

    const indexErrors: string[] = [];

    for (const commit of commits) {
      try {
        await indexCommit(id, commit.sha);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Index failed";
        indexErrors.push(`${commit.sha.slice(0, 7)}: ${message}`);
        console.error("[index] commit indexing failed", {
          repositoryId: id,
          sha: commit.sha,
          error: message,
        });
      }
    }

    const repository = await prisma.repository.findUnique({
      where: { id },
    });

    return NextResponse.json({
      ...repository,
      syncStatus: "success" as const,
      indexErrors: indexErrors.length > 0 ? indexErrors : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    console.error("[sync] manual sync failed", { repositoryId: id, error: message });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
