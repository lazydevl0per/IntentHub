import {
  badRequest,
  demoReadonly,
  getSessionUser,
  notFound,
  parseJsonBody,
  requireObjectiveAccess,
  serverError,
  unauthorized,
} from "@/lib/api";
import {
  getWorkflowResponse,
  startObjectiveWorkflow,
} from "@/lib/ai/objective-workflow";
import { isAiConfigured } from "@/lib/ai/provider";
import { enqueueObjectiveWorkflowStep } from "@/lib/jobs";
import { rateLimitedResponse } from "@/lib/rate-limit";
import { startWorkflowSchema } from "@/lib/validations";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const access = await requireObjectiveAccess(id, user.id);
  if (!access) return notFound();

  const workflow = await getWorkflowResponse(id);
  return NextResponse.json(workflow);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await rateLimitedResponse(request, "workflow-start", 5, 60_000);
  if (limited) return limited;

  const readonly = demoReadonly();
  if (readonly) return readonly;

  const user = await getSessionUser();
  if (!user) return unauthorized();

  if (!isAiConfigured()) {
    return badRequest("AI is not configured");
  }

  const { id } = await params;
  const access = await requireObjectiveAccess(id, user.id);
  if (!access) return notFound();

  const { data: body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const parsed = startWorkflowSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid workflow request");
  }

  try {
    const workflowId = await startObjectiveWorkflow({
      objectiveId: id,
      userId: user.id,
      model: parsed.data.model,
    });

    await enqueueObjectiveWorkflowStep(workflowId, "generate-plans");

    const workflow = await getWorkflowResponse(id);
    return NextResponse.json(workflow, { status: 202 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start workflow";
    if (message.includes("already in progress")) {
      return badRequest(message);
    }
    return serverError("Failed to start workflow", error);
  }
}
