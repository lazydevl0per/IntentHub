import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";

describe("demo mode helpers", () => {
  const originalDemoMode = process.env.DEMO_MODE;

  afterEach(() => {
    if (originalDemoMode === undefined) {
      delete process.env.DEMO_MODE;
    } else {
      process.env.DEMO_MODE = originalDemoMode;
    }
  });

  it("demoReadonly returns 403 when DEMO_MODE is true", async () => {
    process.env.DEMO_MODE = "true";
    const { demoReadonly } = await import("../src/lib/api");
    const response = demoReadonly();
    assert.ok(response);
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.error, "Demo mode is read-only");
  });

  it("demoReadonly returns null when DEMO_MODE is not set", async () => {
    delete process.env.DEMO_MODE;
    const { demoReadonly } = await import("../src/lib/api");
    assert.equal(demoReadonly(), null);
  });

  it("isDemoMode reflects DEMO_MODE env var", async () => {
    process.env.DEMO_MODE = "true";
    const { isDemoMode } = await import("../src/lib/demo");
    assert.equal(isDemoMode(), true);
  });
});

describe("health route", () => {
  const originalDemoMode = process.env.DEMO_MODE;

  afterEach(() => {
    if (originalDemoMode === undefined) {
      delete process.env.DEMO_MODE;
    } else {
      process.env.DEMO_MODE = originalDemoMode;
    }
  });

  it("returns ok in demo mode without database", async () => {
    process.env.DEMO_MODE = "true";
    const { GET } = await import("../src/app/api/health/route");
    const response = await GET(new Request("http://localhost/api/health"));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, "ok");
    assert.equal(body.mode, "demo");
  });
});

describe("register schema", () => {
  it("rejects short passwords", async () => {
    const { registerSchema } = await import("../src/lib/validations");
    const result = registerSchema.safeParse({
      name: "Test User",
      email: "test@example.com",
      password: "short",
    });
    assert.equal(result.success, false);
  });

  it("accepts valid registration input", async () => {
    const { registerSchema } = await import("../src/lib/validations");
    const result = registerSchema.safeParse({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    });
    assert.equal(result.success, true);
  });
});
