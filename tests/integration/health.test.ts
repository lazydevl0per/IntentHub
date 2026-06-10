import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";

describe("health route production mode", () => {
  const env = process.env as Record<string, string | undefined>;
  const originalDemoMode = env.DEMO_MODE;
  const originalHealthToken = env.HEALTH_CHECK_TOKEN;
  const originalNodeEnv = env.NODE_ENV;
  const originalOpenAiKey = env.OPENAI_API_KEY;
  const originalGoogleAiKey = env.GOOGLE_AI_API_KEY;
  const originalAiProvider = env.AI_PROVIDER;

  afterEach(() => {
    if (originalDemoMode === undefined) delete env.DEMO_MODE;
    else env.DEMO_MODE = originalDemoMode;
    if (originalHealthToken === undefined) delete env.HEALTH_CHECK_TOKEN;
    else env.HEALTH_CHECK_TOKEN = originalHealthToken;
    if (originalNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = originalNodeEnv;
    if (originalOpenAiKey === undefined) delete env.OPENAI_API_KEY;
    else env.OPENAI_API_KEY = originalOpenAiKey;
    if (originalGoogleAiKey === undefined) delete env.GOOGLE_AI_API_KEY;
    else env.GOOGLE_AI_API_KEY = originalGoogleAiKey;
    if (originalAiProvider === undefined) delete env.AI_PROVIDER;
    else env.AI_PROVIDER = originalAiProvider;
  });

  it("returns minimal response in production without auth token", async () => {
    env.DEMO_MODE = "true";
    env.NODE_ENV = "production";
    delete env.HEALTH_CHECK_TOKEN;

    const { GET } = await import("../../src/app/api/health/route");
    const response = await GET(new Request("http://localhost/api/health"));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, "ok");
    assert.equal(body.services, undefined);
  });

  it("returns detailed services when bearer token matches", async () => {
    env.DEMO_MODE = "true";
    env.NODE_ENV = "production";
    env.HEALTH_CHECK_TOKEN = "test-token";
    env.OPENAI_API_KEY = "sk-test";

    const { GET } = await import("../../src/app/api/health/route");
    const response = await GET(
      new Request("http://localhost/api/health", {
        headers: { authorization: "Bearer test-token" },
      })
    );
    const body = await response.json();

    assert.equal(body.services?.openai, true);
  });

  it("reports google service when GOOGLE_AI_API_KEY is set", async () => {
    env.DEMO_MODE = "true";
    env.NODE_ENV = "production";
    env.HEALTH_CHECK_TOKEN = "test-token";
    delete env.OPENAI_API_KEY;
    env.AI_PROVIDER = "google";
    env.GOOGLE_AI_API_KEY = "google-test-key";

    const { GET } = await import("../../src/app/api/health/route");
    const response = await GET(
      new Request("http://localhost/api/health", {
        headers: { authorization: "Bearer test-token" },
      })
    );
    const body = await response.json();

    assert.equal(body.services?.google, true);
    assert.equal(body.services?.aiConfigured, true);
  });
});
