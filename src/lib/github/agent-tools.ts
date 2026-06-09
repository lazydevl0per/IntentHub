import { PullRequestState } from "@prisma/client";
import { getUserGitHubToken, createOctokit } from "@/lib/github";
import { prisma } from "@/lib/prisma";

export type AgentFileEdit = {
  path: string;
  content: string;
  message: string;
};

async function getRepositoryOctokit(repositoryId: string, userId: string) {
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

  const [owner, repo] = repository.fullName.split("/");
  return {
    repository,
    owner,
    repo,
    octokit: createOctokit(token),
  };
}

export async function listRepositoryFilePaths(
  repositoryId: string,
  userId: string,
  branch: string,
  limit = 200
) {
  const { owner, repo, octokit, repository } = await getRepositoryOctokit(
    repositoryId,
    userId
  );

  const branchName = branch || repository.defaultBranch;

  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branchName}`,
  });

  const { data } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: refData.object.sha,
    recursive: "1",
  });

  return (data.tree ?? [])
    .filter((entry) => entry.type === "blob" && entry.path)
    .map((entry) => entry.path as string)
    .slice(0, limit);
}

export async function getRepositoryFileContent(
  repositoryId: string,
  userId: string,
  path: string,
  branch: string
) {
  const { owner, repo, octokit } = await getRepositoryOctokit(
    repositoryId,
    userId
  );

  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });

    if (Array.isArray(data) || data.type !== "file" || !("content" in data)) {
      return null;
    }

    return Buffer.from(data.content, "base64").toString("utf8");
  } catch {
    return null;
  }
}

export async function applyAgentFileEdits(
  repositoryId: string,
  userId: string,
  branch: string,
  edits: AgentFileEdit[]
) {
  const { owner, repo, octokit } = await getRepositoryOctokit(
    repositoryId,
    userId
  );

  let applied = 0;

  for (const edit of edits) {
    let sha: string | undefined;

    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path: edit.path,
        ref: branch,
      });

      if (!Array.isArray(data) && "sha" in data) {
        sha = data.sha;
      }
    } catch {
      sha = undefined;
    }

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: edit.path,
      message: edit.message,
      content: Buffer.from(edit.content, "utf8").toString("base64"),
      branch,
      sha,
    });

    applied += 1;
  }

  return applied;
}

export async function createRepositoryPullRequest(params: {
  repositoryId: string;
  userId: string;
  branch: string;
  title: string;
  body: string;
  objectiveId?: string;
  agentRunId?: string;
}) {
  const { repository, owner, repo, octokit } = await getRepositoryOctokit(
    params.repositoryId,
    params.userId
  );

  const { data } = await octokit.pulls.create({
    owner,
    repo,
    title: params.title,
    body: params.body,
    head: params.branch,
    base: repository.defaultBranch,
  });

  const state = data.merged
    ? PullRequestState.MERGED
    : data.state === "open"
      ? PullRequestState.OPEN
      : PullRequestState.CLOSED;

  await prisma.gitPullRequest.upsert({
    where: {
      repositoryId_number: {
        repositoryId: params.repositoryId,
        number: data.number,
      },
    },
    create: {
      repositoryId: params.repositoryId,
      githubId: data.id,
      number: data.number,
      title: data.title,
      state,
      headBranch: params.branch,
      baseBranch: repository.defaultBranch,
      htmlUrl: data.html_url,
      mergedAt: data.merged_at ? new Date(data.merged_at) : null,
      objectiveId: params.objectiveId,
      agentRunId: params.agentRunId,
    },
    update: {
      title: data.title,
      state,
      htmlUrl: data.html_url,
      mergedAt: data.merged_at ? new Date(data.merged_at) : null,
      objectiveId: params.objectiveId,
      agentRunId: params.agentRunId,
    },
  });

  return {
    url: data.html_url,
    number: data.number,
  };
}
