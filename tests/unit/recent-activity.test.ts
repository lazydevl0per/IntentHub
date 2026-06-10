import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectChatIntents,
  isRecencyQuery,
} from "../../src/lib/ai/chat-intent";

describe("chat intent detection", () => {
  it("detects recent change questions", () => {
    assert.equal(isRecencyQuery("What was changed recently?"), true);
    assert.deepEqual(detectChatIntents("What changed lately?"), ["recency"]);
  });

  it("detects rejected and decision questions", () => {
    assert.deepEqual(detectChatIntents("What alternatives were rejected?"), [
      "rejected",
    ]);
    assert.deepEqual(
      detectChatIntents("Why was this architecture chosen?"),
      ["decision"]
    );
  });

  it("detects active objective questions", () => {
    assert.deepEqual(detectChatIntents("Which objectives are still active?"), [
      "active",
    ]);
  });

  it("ignores unrelated questions", () => {
    assert.deepEqual(detectChatIntents("How does pagination work?"), []);
  });
});
