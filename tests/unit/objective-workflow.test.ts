import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isTerminalWorkflowStatus } from "../../src/lib/ai/objective-workflow";

describe("objective workflow status", () => {
  it("treats completed failed and cancelled as terminal", () => {
    assert.equal(isTerminalWorkflowStatus("COMPLETED"), true);
    assert.equal(isTerminalWorkflowStatus("FAILED"), true);
    assert.equal(isTerminalWorkflowStatus("CANCELLED"), true);
  });

  it("treats in-progress statuses as non-terminal", () => {
    assert.equal(isTerminalWorkflowStatus("GENERATING_PLANS"), false);
    assert.equal(isTerminalWorkflowStatus("AWAITING_PLAN_APPROVAL"), false);
    assert.equal(isTerminalWorkflowStatus("RUNNING_AGENT"), false);
    assert.equal(isTerminalWorkflowStatus("EVALUATING"), false);
    assert.equal(isTerminalWorkflowStatus("AWAITING_DECISION_APPROVAL"), false);
  });
});
