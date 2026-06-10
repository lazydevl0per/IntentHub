import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { 
  startObjectiveWorkflow, 
  generateWorkflowPlans, 
  continueAfterPlanApproval, 
  cancelObjectiveWorkflow 
} from "../../src/lib/ai/objective-workflow";
import { prisma } from "../../src/lib/prisma";

describe("objective workflow state machine", () => {
  it("should transition from initial to generating plans", async () => {
    const mockObjective = { id: "obj-1", status: "IN_PROGRESS" };
    mock.method(prisma.objective, "findUnique", () => mockObjective);
    mock.method(prisma.objectiveWorkflow, "findUnique", () => null);
    mock.method(prisma.objectiveWorkflow, "create", (data) => ({ id: "wf-1", ...data }));

    const workflowId = await startObjectiveWorkflow({ objectiveId: "obj-1", userId: "user-1", model: "gpt-4" });
    assert.equal(workflowId, "wf-1");
  });

  it("should fail if cancelling a terminal workflow", async () => {
    mock.method(prisma.objectiveWorkflow, "findUnique", () => ({ id: "wf-1", status: "COMPLETED" }));
    
    await assert.rejects(
      cancelObjectiveWorkflow("wf-1"),
      { message: "Workflow is already finished" }
    );
  });

  it("should transition to CANCELLED when active", async () => {
    mock.method(prisma.objectiveWorkflow, "findUnique", () => ({ id: "wf-1", status: "RUNNING_AGENT" }));
    mock.method(prisma.objectiveWorkflow, "update", () => ({}));

    await assert.doesNotReject(cancelObjectiveWorkflow("wf-1"));
  });
});