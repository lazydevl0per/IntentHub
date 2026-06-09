import {
  demoReadonly,
  getSessionUser,
  notFound,
  requireRepoAccess,
  unauthorized,
} from "@/lib/api";
import { enqueueReindexRepository } from "@/lib/jobs";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const readonly = demoReadonly();
  if (readonly) return readonly;

  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const member = await requireRepoAccess(id, user.id);
  if (!member) return notFound();

  if (member.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    const message = error instanceof Error ? error.message : "Reindex failed";
    console.error("[reindex] repository reindex failed", {
      repositoryId: id,
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
