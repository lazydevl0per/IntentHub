import {
  getSessionUser,
  notFound,
  requireRepoAccess,
  unauthorized,
} from "@/lib/api";
import { enqueueSyncRepository } from "@/lib/jobs";
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
    const handle = await enqueueSyncRepository(id, { commitLimit: 20 });
    const repository = await prisma.repository.findUnique({
      where: { id },
    });

    if (handle) {
      return NextResponse.json(
        {
          ...repository,
          syncStatus: "queued" as const,
          runId: handle.id,
        },
        { status: 202 }
      );
    }

    return NextResponse.json({
      ...repository,
      syncStatus: "success" as const,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    console.error("[sync] manual sync enqueue failed", {
      repositoryId: id,
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
