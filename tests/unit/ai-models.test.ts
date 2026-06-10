import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getChatModelsForProvider,
  getDefaultChatModelForProvider,
} from "../../src/lib/ai/models";

describe("AI chat model lists", () => {
  it("returns current OpenAI models", () => {
    const models = getChatModelsForProvider("openai");
    assert.ok(models.includes("gpt-5.5"));
    assert.ok(models.includes("gpt-5.4-mini"));
    assert.ok(models.includes("gpt-4.1"));
  });

  it("returns current Anthropic models", () => {
    const models = getChatModelsForProvider("anthropic");
    assert.ok(models.includes("claude-opus-4-8"));
    assert.ok(models.includes("claude-sonnet-4-6"));
    assert.ok(models.includes("claude-haiku-4-5"));
  });

  it("returns current Google models", () => {
    const models = getChatModelsForProvider("google");
    assert.ok(models.includes("gemini-2.5-pro"));
    assert.ok(models.includes("gemini-2.5-flash"));
    assert.ok(models.includes("gemini-3.5-flash"));
  });

  it("defaults to OpenAI when provider is unknown", () => {
    assert.equal(getDefaultChatModelForProvider("openai"), "gpt-5.5");
    assert.equal(getDefaultChatModelForProvider("anthropic"), "claude-opus-4-8");
    assert.equal(
      getDefaultChatModelForProvider("google"),
      "gemini-3.1-pro-preview"
    );
  });
});
