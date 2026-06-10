import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("validation schemas", () => {
  it("connectRepoSchema requires github metadata", async () => {
    const { connectRepoSchema } = await import("../../src/lib/validations");

    const valid = connectRepoSchema.safeParse({
      githubId: 123,
      owner: "org",
      name: "repo",
      fullName: "org/repo",
    });
    assert.equal(valid.success, true);

    const invalid = connectRepoSchema.safeParse({ githubId: 123 });
    assert.equal(invalid.success, false);
  });

  it("chatSchema requires message", async () => {
    const { chatSchema } = await import("../../src/lib/validations");

    assert.equal(chatSchema.safeParse({ message: "hello" }).success, true);
    assert.equal(chatSchema.safeParse({ message: "" }).success, false);
  });

  it("executeAgentRunSchema requires planId", async () => {
    const { executeAgentRunSchema } = await import("../../src/lib/validations");

    assert.equal(
      executeAgentRunSchema.safeParse({ planId: "plan-1", model: "gpt-4o-mini" })
        .success,
      true
    );
    assert.equal(
      executeAgentRunSchema.safeParse({ model: "gpt-4o-mini" }).success,
      false
    );
  });

  it("repositorySettingsSchema allows agent prompt", async () => {
    const { repositorySettingsSchema } = await import("../../src/lib/validations");

    const result = repositorySettingsSchema.safeParse({
      agentSystemPrompt: "Be concise.",
    });
    assert.equal(result.success, true);
  });
});
