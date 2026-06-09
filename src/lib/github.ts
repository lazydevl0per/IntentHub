import { Octokit } from "@octokit/rest";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function getUserGitHubToken(userId: string) {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      provider: "github",
    },
  });

  return account?.access_token ?? null;
}

export function createOctokit(token: string) {
  return new Octokit({ auth: token });
}

export async function listUserRepositories(userId: string) {
  const token = await getUserGitHubToken(userId);
  if (!token) {
    return [];
  }

  const octokit = createOctokit(token);
  const { data } = await octokit.repos.listForAuthenticatedUser({
    per_page: 100,
    sort: "updated",
  });

  return data.map((repo) => ({
    githubId: repo.id,
    owner: repo.owner.login,
    name: repo.name,
    fullName: repo.full_name,
    defaultBranch: repo.default_branch,
    private: repo.private,
  }));
}

export async function registerRepositoryWebhook(
  repositoryId: string,
  userId: string
) {
  const repository = await prisma.repository.findUnique({
    where: { id: repositoryId },
  });

  if (!repository) {
    throw new Error("Repository not found");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL is not configured");
  }

  const token = await getUserGitHubToken(userId);
  if (!token) {
    throw new Error("GitHub token not found");
  }

  const octokit = createOctokit(token);
  const [owner, repoName] = repository.fullName.split("/");

  if (repository.githubWebhookId) {
    try {
      await octokit.repos.deleteWebhook({
        owner,
        repo: repoName,
        hook_id: repository.githubWebhookId,
      });
    } catch (error) {
      console.error("[webhook] failed to delete existing webhook", {
        repositoryId,
        hookId: repository.githubWebhookId,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  const { data: hook } = await octokit.repos.createWebhook({
    owner,
    repo: repoName,
    config: {
      url: `${appUrl}/api/webhooks/github`,
      content_type: "json",
      secret: repository.webhookSecret ?? undefined,
    },
    events: ["push", "create", "delete"],
    active: true,
  });

  await prisma.repository.update({
    where: { id: repositoryId },
    data: { githubWebhookId: hook.id },
  });

  return hook.id;
}

export async function deleteRepositoryWebhook(
  repositoryId: string,
  userId: string
) {
  const repository = await prisma.repository.findUnique({
    where: { id: repositoryId },
  });

  if (!repository?.githubWebhookId) {
    return;
  }

  const token = await getUserGitHubToken(userId);
  if (!token) {
    return;
  }

  const octokit = createOctokit(token);
  const [owner, repoName] = repository.fullName.split("/");

  try {
    await octokit.repos.deleteWebhook({
      owner,
      repo: repoName,
      hook_id: repository.githubWebhookId,
    });
  } catch (error) {
    console.error("[webhook] failed to delete webhook on disconnect", {
      repositoryId,
      hookId: repository.githubWebhookId,
      error: error instanceof Error ? error.message : error,
    });
  }
}

export async function syncRepository(repositoryId: string) {
  const repository = await prisma.repository.findUnique({
    where: { id: repositoryId },
    include: {
      members: {
        where: { role: "OWNER" },
        take: 1,
      },
    },
  });

  if (!repository) {
    throw new Error("Repository not found");
  }

  const ownerMember = repository.members[0];
  if (!ownerMember) {
    throw new Error("No repository owner found");
  }

  const token = await getUserGitHubToken(ownerMember.userId);
  if (!token) {
    throw new Error("GitHub token not found");
  }

  const octokit = createOctokit(token);
  const [owner, name] = repository.fullName.split("/");

  const branchLimit = Number(process.env.GITHUB_SYNC_BRANCH_LIMIT ?? 100);
  const commitLimit = Number(process.env.GITHUB_SYNC_COMMIT_LIMIT ?? 500);

  const branches: Awaited<
    ReturnType<typeof octokit.repos.listBranches>
  >["data"] = [];

  for await (const response of octokit.paginate.iterator(
    octokit.repos.listBranches,
    { owner, repo: name, per_page: 100 }
  )) {
    branches.push(...response.data);
    if (branches.length >= branchLimit) {
      break;
    }
  }

  for (const branch of branches.slice(0, branchLimit)) {
    await prisma.gitBranch.upsert({
      where: {
        repositoryId_name: {
          repositoryId,
          name: branch.name,
        },
      },
      create: {
        repositoryId,
        name: branch.name,
        headSha: branch.commit.sha,
      },
      update: {
        headSha: branch.commit.sha,
      },
    });
  }

  const commits: Awaited<
    ReturnType<typeof octokit.repos.listCommits>
  >["data"] = [];

  for await (const response of octokit.paginate.iterator(
    octokit.repos.listCommits,
    { owner, repo: name, per_page: 100 }
  )) {
    commits.push(...response.data);
    if (commits.length >= commitLimit) {
      break;
    }
  }

  for (const commit of commits.slice(0, commitLimit)) {
    const message = commit.commit.message;
    const author =
      commit.commit.author?.name ??
      commit.author?.login ??
      "Unknown";
    const committedAt = commit.commit.author?.date
      ? new Date(commit.commit.author.date)
      : new Date();

    await prisma.gitCommit.upsert({
      where: {
        repositoryId_sha: {
          repositoryId,
          sha: commit.sha,
        },
      },
      create: {
        repositoryId,
        sha: commit.sha,
        message,
        author,
        committedAt,
        parentShas: commit.parents.map((p) => p.sha),
      },
      update: {
        message,
        author,
        committedAt,
        parentShas: commit.parents.map((p) => p.sha),
      },
    });
  }

  await prisma.repository.update({
    where: { id: repositoryId },
    data: { lastSyncedAt: new Date() },
  });
}

export function verifyGitHubWebhook(
  payload: string,
  signature: string | null,
  secret: string
) {
  if (!signature) {
    return false;
  }

  const digest = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  const expected = `sha256=${digest}`;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

export async function handlePushWebhook(
  repositoryId: string,
  payload: {
    ref: string;
    commits: Array<{
      id: string;
      message: string;
      author: { name: string };
      timestamp: string;
    }>;
  }
) {
  const branchName = payload.ref.replace("refs/heads/", "");

  for (const commit of payload.commits) {
    await prisma.gitCommit.upsert({
      where: {
        repositoryId_sha: {
          repositoryId,
          sha: commit.id,
        },
      },
      create: {
        repositoryId,
        sha: commit.id,
        message: commit.message,
        author: commit.author.name,
        committedAt: new Date(commit.timestamp),
        parentShas: [],
      },
      update: {
        message: commit.message,
        author: commit.author.name,
        committedAt: new Date(commit.timestamp),
      },
    });
  }

  const latestCommit = payload.commits[payload.commits.length - 1];
  if (latestCommit) {
    await prisma.gitBranch.upsert({
      where: {
        repositoryId_name: {
          repositoryId,
          name: branchName,
        },
      },
      create: {
        repositoryId,
        name: branchName,
        headSha: latestCommit.id,
      },
      update: {
        headSha: latestCommit.id,
      },
    });
  }

  await prisma.repository.update({
    where: { id: repositoryId },
    data: { lastSyncedAt: new Date() },
  });
}

export async function handleBranchCreateWebhook(
  repositoryId: string,
  payload: { ref: string; ref_type: string }
) {
  if (payload.ref_type !== "branch") {
    return;
  }

  await prisma.gitBranch.upsert({
    where: {
      repositoryId_name: {
        repositoryId,
        name: payload.ref,
      },
    },
    create: {
      repositoryId,
      name: payload.ref,
      headSha: "",
    },
    update: {},
  });
}

export async function handleBranchDeleteWebhook(
  repositoryId: string,
  payload: { ref: string; ref_type: string }
) {
  if (payload.ref_type !== "branch") {
    return;
  }

  await prisma.gitBranch.deleteMany({
    where: {
      repositoryId,
      name: payload.ref,
    },
  });
}

export async function getCommitStats(repositoryId: string, sha: string) {
  const repository = await prisma.repository.findUnique({
    where: { id: repositoryId },
    include: {
      members: {
        where: { role: "OWNER" },
        take: 1,
      },
    },
  });

  if (!repository?.members[0]) {
    return null;
  }

  const token = await getUserGitHubToken(repository.members[0].userId);
  if (!token) {
    return null;
  }

  const octokit = createOctokit(token);
  const [owner, repo] = repository.fullName.split("/");

  const { data } = await octokit.repos.getCommit({
    owner,
    repo,
    ref: sha,
  });

  return {
    additions: data.stats?.additions ?? 0,
    deletions: data.stats?.deletions ?? 0,
    filesChanged: data.files?.length ?? 0,
  };
}

export async function createRepositoryBranch(
  repositoryId: string,
  branchName: string,
  userId: string
) {
  const repository = await prisma.repository.findUnique({
    where: { id: repositoryId },
  });

  if (!repository) {
    throw new Error("Repository not found");
  }

  const token = await getUserGitHubToken(userId);
  if (!token) {
    throw new Error("GitHub token not found");
  }

  const octokit = createOctokit(token);
  const [owner, repo] = repository.fullName.split("/");

  const { data: baseRef } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${repository.defaultBranch}`,
  });

  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: baseRef.object.sha,
  });

  await prisma.gitBranch.upsert({
    where: {
      repositoryId_name: {
        repositoryId,
        name: branchName,
      },
    },
    create: {
      repositoryId,
      name: branchName,
      headSha: baseRef.object.sha,
    },
    update: {
      headSha: baseRef.object.sha,
    },
  });

  return branchName;
}
