import assert from "node:assert/strict";
import { describe, it, before } from "node:test";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe("database integration", { skip: !hasDatabase }, () => {
  before(async () => {
    const { prisma } = await import("../../src/lib/prisma");
    await prisma.$queryRaw`SELECT 1`;
  });

  it("connects to postgres", async () => {
    const { prisma } = await import("../../src/lib/prisma");
    const result = await prisma.$queryRaw<Array<{ one: number }>>`SELECT 1 as one`;
    assert.equal(result[0]?.one, 1);
  });

  it("has applied migrations", async () => {
    const { prisma } = await import("../../src/lib/prisma");
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;
    const names = tables.map((t) => t.tablename);
    assert.ok(names.includes("User"));
    assert.ok(names.includes("Repository"));
    assert.ok(names.includes("ChatMessage"));
  });
});
