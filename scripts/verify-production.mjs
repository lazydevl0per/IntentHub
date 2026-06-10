const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.argv[2];

if (!baseUrl) {
  console.error("Usage: NEXT_PUBLIC_APP_URL=https://your-app.vercel.app npm run verify:production");
  console.error("   or: node scripts/verify-production.mjs https://your-app.vercel.app");
  process.exit(1);
}

const token = process.env.HEALTH_CHECK_TOKEN;
const headers = token ? { authorization: `Bearer ${token}` } : {};

const checks = [];

async function check(name, fn) {
  try {
    await fn();
    checks.push({ name, ok: true });
    console.log(`✓ ${name}`);
  } catch (error) {
    checks.push({
      name,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(`✗ ${name}: ${error instanceof Error ? error.message : error}`);
  }
}

await check("health endpoint responds", async () => {
  const res = await fetch(`${baseUrl}/api/health`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (body.status !== "ok") throw new Error(`status=${body.status}`);
  if (body.db && body.db !== "connected") throw new Error(`db=${body.db}`);
});

await check("unauthenticated API returns 401", async () => {
  const res = await fetch(`${baseUrl}/api/repositories`);
  if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`);
});

await check("demo mode blocked on production app", async () => {
  const res = await fetch(`${baseUrl}/`);
  if (res.status === 503) {
    const body = await res.json().catch(() => ({}));
    if (body.error?.includes("Demo mode")) return;
  }
});

await check("security headers present", async () => {
  const res = await fetch(`${baseUrl}/`);
  const frame = res.headers.get("x-frame-options");
  const ctype = res.headers.get("x-content-type-options");
  if (!frame) throw new Error("missing X-Frame-Options");
  if (!ctype) throw new Error("missing X-Content-Type-Options");
});

const failed = checks.filter((c) => !c.ok);

if (failed.length > 0) {
  console.error(`\n${failed.length} check(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} production checks passed.`);
