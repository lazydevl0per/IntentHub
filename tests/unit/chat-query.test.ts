import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { expandRetrievalQuery } from "../../src/lib/ai/chat-query";

describe("expandRetrievalQuery", () => {
  it("includes recent history for follow-up questions", () => {
    const query = expandRetrievalQuery("What about the rejected one?", [
      { role: "user", content: "What alternatives were rejected?" },
      {
        role: "assistant",
        content: "Plan B was rejected because latency gains were smaller.",
      },
    ]);

    assert.match(query, /rejected/i);
    assert.match(query, /Plan B/i);
    assert.match(query, /What about the rejected one/i);
  });

  it("returns the message when history is empty", () => {
    assert.equal(expandRetrievalQuery("Hello", []), "Hello");
  });
});
