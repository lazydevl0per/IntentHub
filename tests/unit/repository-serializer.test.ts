import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  omitWebhookSecret,
  omitWebhookSecretFromList,
} from "../../src/lib/repository-serializer";

describe("repository-serializer", () => {
  it("should omit webhookSecret from object", () => {
    const repo = { id: 1, name: "test", webhookSecret: "secret" };
    const result = omitWebhookSecret(repo);
    assert.equal("webhookSecret" in result, false);
    assert.equal(result.id, 1);
  });

  it("should omit webhookSecret from list", () => {
    const repos = [
      { id: 1, webhookSecret: "s1" },
      { id: 2, webhookSecret: "s2" },
    ];
    const result = omitWebhookSecretFromList(repos);
    assert.equal(result.every((r) => !("webhookSecret" in r)), true);
  });
});
