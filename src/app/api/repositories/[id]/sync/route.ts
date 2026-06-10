import {
  demoReadonly,
  getSessionUser,
  notFound,
  requireRepoAccess,
  serverError,
  unauthorized,
} from "@/lib/api";
import { enqueueSyncRepository } from "@/lib/jobs";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { rateLimitedResponse } from "@/lib/rate-limit";
import { omitWebhookSecret } from "@/lib/repository-serializer";
import { syncCommitIndexLimit } from "@/lib/sync-limits";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await rateLimitedResponse(request, "sync", 10, 60_000);
  if (limited) return limited;

  const readonly = demoReadonly();
  if (readonly) return readonly;

  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const member = await requireRepoAccess(id, user.id);
  if (!member) return notFound();

  try {
    const handle = await enqueueSyncRepository(id, {
      commitLimit: syncCommitIndexLimit(),
    });
    const repository = await prisma.repository.findUnique({
      where: { id },
    });

    if (!repository) return notFound();

    if (handle) {
      return NextResponse.json(
        {
          ...omitWebhookSecret(repository),
          syncStatus: "queued" as const,
          runId: handle.id,
        },
        { status: 202 }
      );
    }

    return NextResponse.json({
      ...omitWebhookSecret(repository),
      syncStatus: "success" as const,
    });
  } catch (error) {
    logger.error("manual sync enqueue failed", {
      repositoryId: id,
      error: error instanceof Error ? error.message : error,
    });
    return serverError("Sync failed", error);
  }
}
