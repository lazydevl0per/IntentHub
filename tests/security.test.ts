import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it, afterEach } from "node:test";

describe("environment validation", () => {
  const env = process.env as Record<string, string | undefined>;
  const original = { ...env };

  afterEach(() => {
    Object.assign(env, original);
  });

  it("rejects DEMO_MODE in production", async () => {
    env.NODE_ENV = "production";
    env.DEMO_MODE = "true";

    const { validateProductionEnv } = await import("../src/env");
    assert.throws(() => validateProductionEnv(), /DEMO_MODE/);
  });

  it("requires core vars in production", async () => {
    env.NODE_ENV = "production";
    delete env.DEMO_MODE;
    delete env.DATABASE_URL;

    const { validateProductionEnv } = await import("../src/env");
    assert.throws(() => validateProductionEnv(), /DATABASE_URL/);
  });

  it("passes in development without full production vars", async () => {
    env.NODE_ENV = "development";
    delete env.DEMO_MODE;
    delete env.DATABASE_URL;

    const { validateProductionEnv } = await import("../src/env");
    assert.doesNotThrow(() => validateProductionEnv());
  });
});

describe("repository serializer", () => {
  it("omits webhookSecret from repository objects", async () => {
    const { omitWebhookSecret, omitWebhookSecretFromList } = await import(
      "../src/lib/repository-serializer"
    );

    const repo = {
      id: "r1",
      fullName: "org/repo",
      webhookSecret: "secret-value",
    };

    const sanitized = omitWebhookSecret(repo);
    assert.equal("webhookSecret" in sanitized, false);
    assert.equal(sanitized.id, "r1");

    const list = omitWebhookSecretFromList([repo]);
    assert.equal("webhookSecret" in list[0], false);
  });
});

describe("github webhook verification", () => {
  it("accepts valid HMAC signatures", async () => {
    const { verifyGitHubWebhook } = await import("../src/lib/github");
    const payload = JSON.stringify({ repository: { id: 1 } });
    const secret = "test-secret";
    const digest = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    assert.equal(
      verifyGitHubWebhook(payload, `sha256=${digest}`, secret),
      true
    );
  });

  it("rejects invalid signatures", async () => {
    const { verifyGitHubWebhook } = await import("../src/lib/github");
    const payload = JSON.stringify({ repository: { id: 1 } });

    assert.equal(
      verifyGitHubWebhook(payload, "sha256=invalid", "test-secret"),
      false
    );
    assert.equal(verifyGitHubWebhook(payload, null, "test-secret"), false);
  });
});

describe("rate limiting", () => {
  it("allows requests within limit", async () => {
    const { checkRateLimit } = await import("../src/lib/rate-limit");
    const key = `test-${Date.now()}`;

    const first = await checkRateLimit(key, 3, 60_000);
    const second = await checkRateLimit(key, 3, 60_000);

    assert.equal(first.success, true);
    assert.equal(second.success, true);
  });

  it("blocks requests over limit", async () => {
    const { checkRateLimit } = await import("../src/lib/rate-limit");
    const key = `test-block-${Date.now()}`;

    await checkRateLimit(key, 2, 60_000);
    await checkRateLimit(key, 2, 60_000);
    const third = await checkRateLimit(key, 2, 60_000);

    assert.equal(third.success, false);
  });
});
