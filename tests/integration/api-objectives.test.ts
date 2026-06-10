import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import { requireObjectiveAccess } from "../../src/lib/api";
import { prisma } from "../../src/lib/prisma";

describe("objective access", () => {
  const originalFindUnique = prisma.objective.findUnique.bind(prisma.objective);

  afterEach(() => {
    prisma.objective.findUnique = originalFindUnique;
  });

  it("returns null when objective does not exist", async () => {
    prisma.objective.findUnique = async () => null as never;

    const access = await requireObjectiveAccess("non-existent", "user-1");
    assert.equal(access, null);
  });
});
