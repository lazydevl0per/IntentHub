import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";

describe("health route production mode", () => {
  const env = process.env as Record<string, string | undefined>;
  const originalDemoMode = env.DEMO_MODE;
  const originalHealthToken = env.HEALTH_CHECK_TOKEN;
  const originalNodeEnv = env.NODE_ENV;

  afterEach(() => {
    if (originalDemoMode === undefined) delete env.DEMO_MODE;
    else env.DEMO_MODE = originalDemoMode;
    if (originalHealthToken === undefined) delete env.HEALTH_CHECK_TOKEN;
    else env.HEALTH_CHECK_TOKEN = originalHealthToken;
    if (originalNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = originalNodeEnv;
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
});
