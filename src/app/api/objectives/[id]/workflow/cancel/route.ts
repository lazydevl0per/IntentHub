import {
  badRequest,
  demoReadonly,
  getSessionUser,
  notFound,
  requireObjectiveAccess,
  serverError,
  unauthorized,
} from "@/lib/api";
import {
  cancelObjectiveWorkflow,
  getWorkflowResponse,
} from "@/lib/ai/objective-workflow";
import { prisma } from "@/lib/prisma";
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
  const access = await requireObjectiveAccess(id, user.id);
  if (!access) return notFound();

  const workflow = await prisma.objectiveWorkflow.findUnique({
    where: { objectiveId: id },
  });

  if (!workflow) {
    return badRequest("No workflow found for this objective");
  }

  try {
    await cancelObjectiveWorkflow(workflow.id);
    const response = await getWorkflowResponse(id);
    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to cancel workflow";
    if (message.includes("already finished")) {
      return badRequest(message);
    }
    return serverError("Failed to cancel workflow", error);
  }
}
