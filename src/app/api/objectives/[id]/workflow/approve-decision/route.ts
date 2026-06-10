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
  approveWorkflowDecision,
  getWorkflowResponse,
} from "@/lib/ai/objective-workflow";
import { prisma } from "@/lib/prisma";
import { approveWorkflowDecisionSchema } from "@/lib/validations";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
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

  if (workflow.status !== "AWAITING_DECISION_APPROVAL") {
    return badRequest("Workflow is not awaiting decision approval");
  }

  const { data: body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const parsed = approveWorkflowDecisionSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return badRequest("Invalid decision approval data");
  }

  try {
    const decision = await approveWorkflowDecision({
      workflowId: workflow.id,
      userId: user.id,
      selectedPlanId: parsed.data.selectedPlanId,
      rationale: parsed.data.rationale,
      linkedCommitSha: parsed.data.linkedCommitSha,
    });

    const response = await getWorkflowResponse(id);
    return NextResponse.json({ decision, workflow: response }, { status: 201 });
  } catch (error) {
    return serverError("Failed to approve decision", error);
  }
}
