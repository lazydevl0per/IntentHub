import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isRecencyQuery } from "../../src/lib/ai/recent-activity";

describe("isRecencyQuery", () => {
  it("detects recent change questions", () => {
    assert.equal(isRecencyQuery("What was changed recently?"), true);
    assert.equal(isRecencyQuery("What changed lately?"), true);
    assert.equal(isRecencyQuery("Show latest updates"), true);
  });

  it("ignores unrelated questions", () => {
    assert.equal(isRecencyQuery("Why was Redis chosen?"), false);
    assert.equal(isRecencyQuery("What alternatives were rejected?"), false);
  });
});
