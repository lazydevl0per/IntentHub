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

  const branchesResponse = await octokit.repos.listBranches({
    owner,
    repo: name,
    per_page: 100,
  });

  for (const branch of branchesResponse.data) {
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

  const commitsResponse = await octokit.repos.listCommits({
    owner,
    repo: name,
    per_page: 100,
  });

  for (const commit of commitsResponse.data) {
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
