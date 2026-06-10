import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { prisma } from "../../src/lib/prisma";
import { GET } from "../../src/app/api/objectives/[id]/route";

describe("API Objectives Integration", () => {
  it("returns 404 for non-existent objective", async () => {
    mock.method(prisma.objective, "findUnique", () => null);
    
    const request = new Request("http://localhost/api/objectives/non-existent");
    const response = await GET(request, { params: Promise.resolve({ id: "non-existent" }) });
    
    assert.equal(response.status, 404);
  });
});