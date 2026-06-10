import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import { PullRequestState } from "@prisma/client";
import {
  GITHUB_LARGE_PR_ID,
  POSTGRES_INT4_MAX,
} from "../fixtures/git-pull-request-github-id";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe("GitPullRequest githubId storage", { skip: !hasDatabase }, () => {
  let prisma: Awaited<typeof import("../../src/lib/prisma")>["prisma"];
  let repositoryId = "";
  const repoGithubId = 91_000_000 + Math.floor(Math.random() * 1_000_000);
  const prNumber = 10_000 + Math.floor(Math.random() * 1_000_000);

  before(async () => {
    ({ prisma } = await import("../../src/lib/prisma"));
    await prisma.$queryRaw`SELECT 1`;
  });

  before(async () => {
    const repository = await prisma.repository.create({
      data: {
        githubId: repoGithubId,
        owner: "test-owner",
        name: `pr-bigint-${repoGithubId}`,
        fullName: `test-owner/pr-bigint-${repoGithubId}`,
        defaultBranch: "main",
      },
    });
    repositoryId = repository.id;
  });

  afterEach(async () => {
    if (!repositoryId) return;
    await prisma.gitPullRequest.deleteMany({ where: { repositoryId } });
  });

  after(async () => {
    if (!repositoryId) return;
    await prisma.gitPullRequest.deleteMany({ where: { repositoryId } });
    await prisma.repository.delete({ where: { id: repositoryId } });
  });

  it("stores GitPullRequest.githubId as BIGINT in postgres", async () => {
    const columns = await prisma.$queryRaw<
      Array<{ data_type: string; numeric_precision: number | null }>
    >`
      SELECT data_type, numeric_precision
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'GitPullRequest'
        AND column_name = 'githubId'
    `;

    assert.equal(columns[0]?.data_type, "bigint");
    assert.equal(columns[0]?.numeric_precision, 64);
  });

  it("creates pull requests with github ids above INT4 max", async () => {
    assert.ok(GITHUB_LARGE_PR_ID > POSTGRES_INT4_MAX);

    const created = await prisma.gitPullRequest.create({
      data: {
        repositoryId,
        githubId: GITHUB_LARGE_PR_ID,
        number: prNumber,
        title: "Large github id regression",
        state: PullRequestState.OPEN,
        headBranch: "feature/large-id",
        baseBranch: "main",
        htmlUrl: "https://github.com/test-owner/test-repo/pull/1",
      },
    });

    assert.equal(created.githubId, BigInt(GITHUB_LARGE_PR_ID));
  });

  it("upserts pull requests using numeric github api ids", async () => {
    const number = prNumber + 1;

    const created = await prisma.gitPullRequest.upsert({
      where: {
        repositoryId_number: {
          repositoryId,
          number,
        },
      },
      create: {
        repositoryId,
        githubId: GITHUB_LARGE_PR_ID,
        number,
        title: "Upsert create",
        state: PullRequestState.OPEN,
        headBranch: "intenthub/test-branch",
        baseBranch: "main",
        htmlUrl: "https://github.com/test-owner/test-repo/pull/2",
      },
      update: {
        title: "Upsert update",
        state: PullRequestState.MERGED,
        htmlUrl: "https://github.com/test-owner/test-repo/pull/2",
      },
    });

    assert.equal(created.githubId, BigInt(GITHUB_LARGE_PR_ID));
    assert.equal(created.title, "Upsert create");

    const updated = await prisma.gitPullRequest.upsert({
      where: {
        repositoryId_number: {
          repositoryId,
          number,
        },
      },
      create: {
        repositoryId,
        githubId: GITHUB_LARGE_PR_ID,
        number,
        title: "Should not recreate",
        state: PullRequestState.OPEN,
        headBranch: "intenthub/test-branch",
        baseBranch: "main",
        htmlUrl: "https://github.com/test-owner/test-repo/pull/2",
      },
      update: {
        title: "Upsert update",
        state: PullRequestState.MERGED,
        htmlUrl: "https://github.com/test-owner/test-repo/pull/2",
      },
    });

    assert.equal(updated.githubId, BigInt(GITHUB_LARGE_PR_ID));
    assert.equal(updated.title, "Upsert update");
    assert.equal(updated.state, PullRequestState.MERGED);
  });
});
