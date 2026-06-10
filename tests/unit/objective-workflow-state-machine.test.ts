import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import {
  startObjectiveWorkflow,
  cancelObjectiveWorkflow,
} from "../../src/lib/ai/objective-workflow";
import { prisma } from "../../src/lib/prisma";

describe("objective workflow state machine", () => {
  const originalObjectiveFindUnique = prisma.objective.findUnique.bind(
    prisma.objective
  );
  const originalWorkflowFindUnique = prisma.objectiveWorkflow.findUnique.bind(
    prisma.objectiveWorkflow
  );
  const originalWorkflowCreate = prisma.objectiveWorkflow.create.bind(
    prisma.objectiveWorkflow
  );
  const originalWorkflowUpdate = prisma.objectiveWorkflow.update.bind(
    prisma.objectiveWorkflow
  );

  afterEach(() => {
    prisma.objective.findUnique = originalObjectiveFindUnique;
    prisma.objectiveWorkflow.findUnique = originalWorkflowFindUnique;
    prisma.objectiveWorkflow.create = originalWorkflowCreate;
    prisma.objectiveWorkflow.update = originalWorkflowUpdate;
  });

  it("should transition from initial to generating plans", async () => {
    prisma.objective.findUnique = async () =>
      ({ id: "obj-1", status: "IN_PROGRESS" }) as never;
    prisma.objectiveWorkflow.findUnique = async () => null as never;
    prisma.objectiveWorkflow.create = async () => ({ id: "wf-1" }) as never;

    const workflowId = await startObjectiveWorkflow({
      objectiveId: "obj-1",
      userId: "user-1",
      model: "gpt-4",
    });
    assert.equal(workflowId, "wf-1");
  });

  it("should fail if cancelling a terminal workflow", async () => {
    prisma.objectiveWorkflow.findUnique = async () =>
      ({ id: "wf-1", status: "COMPLETED" }) as never;

    await assert.rejects(cancelObjectiveWorkflow("wf-1"), {
      message: "Workflow is already finished",
    });
  });

  it("should transition to CANCELLED when active", async () => {
    prisma.objectiveWorkflow.findUnique = async () =>
      ({ id: "wf-1", status: "RUNNING_AGENT" }) as never;
    prisma.objectiveWorkflow.update = async () => ({}) as never;

    await assert.doesNotReject(cancelObjectiveWorkflow("wf-1"));
  });
});
