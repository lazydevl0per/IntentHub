import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { commitsMatch } from "../../src/lib/decision";

describe("commitsMatch", () => {
  it("matches full and short shas", () => {
    const full = "a1b2c3d4e5f6789012345678901234567890abcd";
    assert.equal(commitsMatch("a1b2c3d", full), true);
    assert.equal(commitsMatch(full, "a1b2c3d"), true);
    assert.equal(commitsMatch("deadbeef", full), false);
  });
});
