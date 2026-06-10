import {
  demoReadonly,
  getSessionUser,
  notFound,
  requireRepoAccess,
  serverError,
  unauthorized,
} from "@/lib/api";
import { enqueueReindexRepository } from "@/lib/jobs";
import { logger } from "@/lib/logger";
import { rateLimitedResponse } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await rateLimitedResponse(request, "reindex", 5, 60_000);
  if (limited) return limited;

  const readonly = demoReadonly();
  if (readonly) return readonly;

  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const member = await requireRepoAccess(id, user.id);
  if (!member) return notFound();

  if (member.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const handle = await enqueueReindexRepository(id);

    return NextResponse.json(
      {
        repositoryId: id,
        reindexStatus: handle ? ("queued" as const) : ("success" as const),
        runId: handle?.id,
      },
      { status: handle ? 202 : 200 }
    );
  } catch (error) {
    logger.error("repository reindex failed", {
      repositoryId: id,
      error: error instanceof Error ? error.message : error,
    });
    return serverError("Reindex failed", error);
  }
}
