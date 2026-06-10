import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GITHUB_LARGE_PR_ID,
  POSTGRES_INT4_MAX,
  buildGitPullRequestCreateGithubId,
} from "../fixtures/git-pull-request-github-id";

describe("GitPullRequest githubId boundaries", () => {
  it("documents postgres INT4 max", () => {
    assert.equal(POSTGRES_INT4_MAX, 2_147_483_647);
  });

  it("rejects storing the reported failure id in INT4", () => {
    assert.ok(GITHUB_LARGE_PR_ID > POSTGRES_INT4_MAX);
  });

  it("keeps large github pull ids as javascript numbers", () => {
    assert.equal(typeof GITHUB_LARGE_PR_ID, "number");
    assert.equal(Number.isSafeInteger(GITHUB_LARGE_PR_ID), true);
  });

  it("passes github api ids through without bigint coercion", () => {
    const githubApiId = GITHUB_LARGE_PR_ID;
    const storedValue = buildGitPullRequestCreateGithubId(githubApiId);

    assert.equal(typeof storedValue, "number");
    assert.equal(storedValue, githubApiId);
    assert.notEqual(typeof storedValue, "bigint");
  });

  it("accepts small github pull ids unchanged", () => {
    assert.equal(buildGitPullRequestCreateGithubId(12345), 12345);
  });
});
