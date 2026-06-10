import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cn } from "../../src/lib/utils";

describe("utils", () => {
  it("should merge class names correctly", () => {
    assert.equal(cn("a", "b"), "a b");
    assert.equal(cn("a", { b: true, c: false }), "a b");
  });
});
