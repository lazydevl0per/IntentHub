import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  approveWorkflowDecisionSchema,
  startWorkflowSchema,
} from "../../src/lib/validations";

describe("workflow validations", () => {
  it("requires model for workflow start", () => {
    const valid = startWorkflowSchema.safeParse({ model: "gpt-4o-mini" });
    assert.equal(valid.success, true);

    const invalid = startWorkflowSchema.safeParse({});
    assert.equal(invalid.success, false);
  });

  it("allows optional decision overrides", () => {
    const empty = approveWorkflowDecisionSchema.safeParse({});
    assert.equal(empty.success, true);

    const full = approveWorkflowDecisionSchema.safeParse({
      selectedPlanId: "plan-1",
      rationale: "Best tradeoff for latency.",
      linkedCommitSha: "abc1234",
    });
    assert.equal(full.success, true);
  });
});
