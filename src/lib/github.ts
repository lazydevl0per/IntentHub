import { Octokit } from "@octokit/rest";
import { PullRequestState } from "@prisma/client";
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

export async function verifyUserOwnsRepository(
  userId: string,
  githubId: number
) {
  const token = await getUserGitHubToken(userId);
  if (!token) {
    return false;
  }

  const octokit = createOctokit(token);
  const { data } = await octokit.repos.listForAuthenticatedUser({
    per_page: 100,
    sort: "updated",
  });

  return data.some((repo) => repo.id === githubId);
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
    events: ["push", "create", "delete", "pull_request", "check_run"],
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

  await syncPullRequests(repositoryId);
  await syncTags(repositoryId);
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

export async function syncPullRequests(repositoryId: string) {
  const repository = await prisma.repository.findUnique({
    where: { id: repositoryId },
    include: {
      members: { where: { role: "OWNER" }, take: 1 },
    },
  });

  if (!repository?.members[0]) return;

  const token = await getUserGitHubToken(repository.members[0].userId);
  if (!token) return;

  const octokit = createOctokit(token);
  const [owner, name] = repository.fullName.split("/");

  const { data } = await octokit.pulls.list({
    owner,
    repo: name,
    state: "all",
    per_page: 50,
  });

  for (const pull of data) {
    const agentRun = pull.head.ref.startsWith("intenthub/")
      ? await prisma.agentRun.findFirst({
          where: {
            objective: { repositoryId },
            branchName: pull.head.ref,
          },
        })
      : null;

    const state = pull.merged_at
      ? PullRequestState.MERGED
      : pull.state === "open"
        ? PullRequestState.OPEN
        : PullRequestState.CLOSED;

    await prisma.gitPullRequest.upsert({
      where: {
        repositoryId_number: {
          repositoryId,
          number: pull.number,
        },
      },
      create: {
        repositoryId,
        githubId: pull.id,
        number: pull.number,
        title: pull.title,
        state,
        headBranch: pull.head.ref,
        baseBranch: pull.base.ref,
        htmlUrl: pull.html_url,
        mergedAt: pull.merged_at ? new Date(pull.merged_at) : null,
        objectiveId: agentRun?.objectiveId,
        agentRunId: agentRun?.id,
      },
      update: {
        title: pull.title,
        state,
        headBranch: pull.head.ref,
        baseBranch: pull.base.ref,
        htmlUrl: pull.html_url,
        mergedAt: pull.merged_at ? new Date(pull.merged_at) : null,
        objectiveId: agentRun?.objectiveId ?? undefined,
        agentRunId: agentRun?.id ?? undefined,
      },
    });

    if (pull.merged_at && pull.merge_commit_sha) {
      const existingPr = await prisma.gitPullRequest.findUnique({
        where: {
          repositoryId_number: {
            repositoryId,
            number: pull.number,
          },
        },
        select: { objectiveId: true },
      });
      const objectiveId = agentRun?.objectiveId ?? existingPr?.objectiveId;

      if (objectiveId) {
        await recordMergedPullRequestOutcome({
          repositoryId,
          objectiveId,
          pullNumber: pull.number,
          mergeCommitSha: pull.merge_commit_sha,
          commitMessage: pull.title,
        });
      }
    }
  }
}

export async function recordMergedPullRequestOutcome(params: {
  repositoryId: string;
  objectiveId: string;
  pullNumber: number;
  mergeCommitSha: string;
  commitMessage?: string;
}) {
  await prisma.gitCommit.upsert({
    where: {
      repositoryId_sha: {
        repositoryId: params.repositoryId,
        sha: params.mergeCommitSha,
      },
    },
    create: {
      repositoryId: params.repositoryId,
      sha: params.mergeCommitSha,
      message:
        params.commitMessage ?? `Merged pull request #${params.pullNumber}`,
      author: "GitHub",
      committedAt: new Date(),
      parentShas: [],
    },
    update: {
      message: params.commitMessage ?? undefined,
    },
  });

  await prisma.deployment.upsert({
    where: { id: `${params.repositoryId}-${params.pullNumber}` },
    create: {
      id: `${params.repositoryId}-${params.pullNumber}`,
      repositoryId: params.repositoryId,
      environment: "production",
      commitSha: params.mergeCommitSha,
      objectiveId: params.objectiveId,
    },
    update: {
      commitSha: params.mergeCommitSha,
      deployedAt: new Date(),
      objectiveId: params.objectiveId,
    },
  });

  const { linkDecisionToCommit } = await import("@/lib/decision");
  await linkDecisionToCommit(params.objectiveId, params.mergeCommitSha);

  try {
    const { enqueueIndexEntity } = await import("@/lib/jobs");
    await enqueueIndexEntity({
      entity: "commit",
      repositoryId: params.repositoryId,
      sha: params.mergeCommitSha,
    });
  } catch (error) {
    console.error("[index] merge commit indexing enqueue failed", {
      repositoryId: params.repositoryId,
      sha: params.mergeCommitSha,
      error: error instanceof Error ? error.message : error,
    });
  }
}

export async function syncObjectiveDecisionCommit(objectiveId: string) {
  const objective = await prisma.objective.findUnique({
    where: { id: objectiveId },
    include: {
      decision: true,
      repository: {
        include: {
          members: {
            where: { role: "OWNER" },
            take: 1,
          },
        },
      },
      agentRuns: {
        where: { pullRequestNumber: { not: null } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!objective?.decision || objective.decision.linkedCommitSha) {
    return objective?.decision?.linkedCommitSha ?? null;
  }

  const linkedPull = await prisma.gitPullRequest.findFirst({
    where: {
      objectiveId,
      state: PullRequestState.MERGED,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (linkedPull) {
    const deployment = await prisma.deployment.findFirst({
      where: { id: `${objective.repositoryId}-${linkedPull.number}` },
    });

    if (deployment?.commitSha) {
      await recordMergedPullRequestOutcome({
        repositoryId: objective.repositoryId,
        objectiveId,
        pullNumber: linkedPull.number,
        mergeCommitSha: deployment.commitSha,
        commitMessage: linkedPull.title,
      });
      return deployment.commitSha;
    }
  }

  const ownerMember = objective.repository.members[0];
  if (!ownerMember) {
    return null;
  }

  const token = await getUserGitHubToken(ownerMember.userId);
  if (!token) {
    return null;
  }

  const octokit = createOctokit(token);
  const [owner, repo] = objective.repository.fullName.split("/");

  for (const run of objective.agentRuns) {
    if (!run.pullRequestNumber) continue;

    try {
      const { data: pull } = await octokit.pulls.get({
        owner,
        repo,
        pull_number: run.pullRequestNumber,
      });

      if (!pull.merged || !pull.merge_commit_sha) {
        continue;
      }

      await prisma.gitPullRequest.updateMany({
        where: {
          repositoryId: objective.repositoryId,
          number: run.pullRequestNumber,
        },
        data: {
          state: PullRequestState.MERGED,
          mergedAt: pull.merged_at ? new Date(pull.merged_at) : new Date(),
          objectiveId,
          agentRunId: run.id,
        },
      });

      await recordMergedPullRequestOutcome({
        repositoryId: objective.repositoryId,
        objectiveId,
        pullNumber: run.pullRequestNumber,
        mergeCommitSha: pull.merge_commit_sha,
        commitMessage: pull.title,
      });

      return pull.merge_commit_sha;
    } catch {
      continue;
    }
  }

  return null;
}

export async function syncTags(repositoryId: string) {
  const repository = await prisma.repository.findUnique({
    where: { id: repositoryId },
    include: {
      members: { where: { role: "OWNER" }, take: 1 },
    },
  });

  if (!repository?.members[0]) return;

  const token = await getUserGitHubToken(repository.members[0].userId);
  if (!token) return;

  const octokit = createOctokit(token);
  const [owner, name] = repository.fullName.split("/");

  const { data } = await octokit.repos.listTags({
    owner,
    repo: name,
    per_page: 50,
  });

  for (const tag of data) {
    if (!tag.name || !tag.commit.sha) continue;

    await prisma.gitTag.upsert({
      where: {
        repositoryId_name: {
          repositoryId,
          name: tag.name,
        },
      },
      create: {
        repositoryId,
        name: tag.name,
        sha: tag.commit.sha,
      },
      update: {
        sha: tag.commit.sha,
      },
    });
  }
}

export async function handlePullRequestWebhook(
  repositoryId: string,
  payload: {
    action: string;
    pull_request: {
      id: number;
      number: number;
      title: string;
      state: string;
      merged: boolean;
      merged_at: string | null;
      merge_commit_sha: string | null;
      html_url: string;
      head: { ref: string };
      base: { ref: string };
    };
  }
) {
  const pull = payload.pull_request;

  const agentRun = pull.head.ref.startsWith("intenthub/")
    ? await prisma.agentRun.findFirst({
        where: {
          objective: { repositoryId },
          branchName: pull.head.ref,
        },
      })
    : null;

  const state =
    pull.merged_at || (payload.action === "closed" && Boolean(pull.merge_commit_sha))
      ? PullRequestState.MERGED
      : pull.state === "open"
        ? PullRequestState.OPEN
        : PullRequestState.CLOSED;

  await prisma.gitPullRequest.upsert({
    where: {
      repositoryId_number: {
        repositoryId,
        number: pull.number,
      },
    },
    create: {
      repositoryId,
      githubId: pull.id,
      number: pull.number,
      title: pull.title,
      state,
      headBranch: pull.head.ref,
      baseBranch: pull.base.ref,
      htmlUrl: pull.html_url,
      mergedAt: pull.merged_at ? new Date(pull.merged_at) : null,
      objectiveId: agentRun?.objectiveId,
      agentRunId: agentRun?.id,
    },
    update: {
      title: pull.title,
      state,
      htmlUrl: pull.html_url,
      mergedAt: pull.merged_at ? new Date(pull.merged_at) : null,
      objectiveId: agentRun?.objectiveId ?? undefined,
      agentRunId: agentRun?.id ?? undefined,
    },
  });

  if (pull.merged_at && pull.merge_commit_sha) {
    const savedPr = await prisma.gitPullRequest.findUnique({
      where: {
        repositoryId_number: {
          repositoryId,
          number: pull.number,
        },
      },
      select: { objectiveId: true },
    });
    const objectiveId = agentRun?.objectiveId ?? savedPr?.objectiveId;

    if (objectiveId) {
      await recordMergedPullRequestOutcome({
        repositoryId,
        objectiveId,
        pullNumber: pull.number,
        mergeCommitSha: pull.merge_commit_sha,
        commitMessage: pull.title,
      });
    }
  }
}

export async function handleCheckRunWebhook(
  repositoryId: string,
  payload: {
    action: string;
    check_run: {
      name: string;
      conclusion: string | null;
      status: string;
      head_branch: string;
      output?: { summary?: string | null; title?: string | null };
    };
  }
) {
  if (payload.action !== "completed" || payload.check_run.status !== "completed") {
    return;
  }

  const agentRun = await prisma.agentRun.findFirst({
    where: {
      objective: { repositoryId },
      branchName: payload.check_run.head_branch,
    },
    include: { objective: true },
  });

  if (!agentRun) return;

  const score =
    payload.check_run.conclusion === "success"
      ? 100
      : payload.check_run.conclusion === "failure"
        ? 0
        : 50;

  await prisma.evaluation.create({
    data: {
      objectiveId: agentRun.objectiveId,
      planId: agentRun.planId,
      agentRunId: agentRun.id,
      type: "TEST",
      score,
      summary:
        payload.check_run.output?.summary ??
        payload.check_run.output?.title ??
        `${payload.check_run.name}: ${payload.check_run.conclusion ?? "completed"}`,
      createdById: agentRun.createdById,
    },
  });
}
