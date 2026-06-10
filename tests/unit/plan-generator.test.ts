import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeGeneratedPlan } from "../../src/lib/ai/plan-generator";

describe("normalizeGeneratedPlan", () => {
  it("joins array approach values into a single string", () => {
    const plan = normalizeGeneratedPlan({
      title: "Unit tests",
      description: "Add coverage for workflow logic.",
      approach: [
        "Identify critical utility functions.",
        "Use Vitest for state transition tests.",
        "Mock Prisma client.",
      ],
    });

    assert.ok(plan);
    assert.equal(
      plan.approach,
      "Identify critical utility functions.\nUse Vitest for state transition tests.\nMock Prisma client."
    );
  });

  it("returns null when required fields are missing", () => {
    assert.equal(
      normalizeGeneratedPlan({
        title: "Only title",
        description: "",
        approach: ["step one"],
      }),
      null
    );
  });
});
