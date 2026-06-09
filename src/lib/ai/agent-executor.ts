import { chatCompletionJson, chatCompletionWithUsage, type ChatMessage } from "@/lib/ai/provider";
import {
  applyAgentFileEdits,
  createRepositoryPullRequest,
  getRepositoryFileContent,
  listRepositoryFilePaths,
} from "@/lib/github/agent-tools";
import { createRepositoryBranch } from "@/lib/github";
import { indexAgentRun } from "@/lib/indexing";
import { prisma } from "@/lib/prisma";

const DEFAULT_SYSTEM_PROMPT = `You are an AI software development agent working inside IntentHub.
You implement plans by reading repository files and producing concrete file edits.
Respond with valid JSON only using this schema:
{
  "action": "read_files" | "write_files" | "complete",
  "filesToRead": string[],
  "fileEdits": [{ "path": string, "content": string, "message": string }],
  "report": string
}
Use read_files when you need source context. Use write_files to apply changes.
Use complete when implementation is done and include a concise report.`;

const MAX_TOOL_ITERATIONS = 4;
const MAX_FILE_READS = 8;

type AgentStepResponse = {
  action: "read_files" | "write_files" | "complete";
  filesToRead?: string[];
  fileEdits?: Array<{ path: string; content: string; message: string }>;
  report?: string;
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function buildAgentBranchName(planTitle: string) {
  return `intenthub/${slugify(planTitle)}-${Date.now().toString(36)}`;
}

export function buildAgentPrompt(params: {
  objectiveTitle: string;
  objectiveDescription: string;
  planTitle: string;
  planDescription: string;
  planApproach: string;
  repositoryFullName: string;
  branchName: string;
}) {
  return [
    `Repository: ${params.repositoryFullName}`,
    `Branch: ${params.branchName}`,
    "",
    `Objective: ${params.objectiveTitle}`,
    params.objectiveDescription,
    "",
    `Plan: ${params.planTitle}`,
    params.planDescription,
    "",
    "Approach:",
    params.planApproach,
    "",
    "Implement this plan on the assigned branch with concrete file edits.",
  ].join("\n");
}

export async function executeAgentRun(agentRunId: string) {
  const agentRun = await prisma.agentRun.findUnique({
    where: { id: agentRunId },
    include: {
      plan: true,
      objective: {
        include: { repository: true },
      },
      createdBy: true,
    },
  });

  if (!agentRun) {
    throw new Error("Agent run not found");
  }

  if (!agentRun.plan) {
    throw new Error("Agent run requires a linked plan");
  }

  const branchName =
    agentRun.branchName ?? buildAgentBranchName(agentRun.plan.title);

  await prisma.agentRun.update({
    where: { id: agentRunId },
    data: {
      status: "RUNNING",
      branchName,
      errorMessage: null,
    },
  });

  try {
    await createRepositoryBranch(
      agentRun.objective.repositoryId,
      branchName,
      agentRun.createdById
    );

    const systemPrompt =
      agentRun.objective.repository.agentSystemPrompt ?? DEFAULT_SYSTEM_PROMPT;

    const userPrompt =
      agentRun.prompt ||
      buildAgentPrompt({
        objectiveTitle: agentRun.objective.title,
        objectiveDescription: agentRun.objective.description,
        planTitle: agentRun.plan.title,
        planDescription: agentRun.plan.description,
        planApproach: agentRun.plan.approach,
        repositoryFullName: agentRun.objective.repository.fullName,
        branchName,
      });

    const filePaths = await listRepositoryFilePaths(
      agentRun.objective.repositoryId,
      agentRun.createdById,
      agentRun.objective.repository.defaultBranch
    );

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          userPrompt,
          "",
          "Repository file paths:",
          filePaths.join("\n") || "(empty repository tree)",
        ].join("\n"),
      },
    ];

    let filesChanged = 0;
    let report = "";
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const step = await chatCompletionJson<AgentStepResponse>(messages);
      totalPromptTokens += 500;
      totalCompletionTokens += 300;

      if (step.action === "read_files" && step.filesToRead?.length) {
        const snippets: string[] = [];

        for (const path of step.filesToRead.slice(0, MAX_FILE_READS)) {
          const content = await getRepositoryFileContent(
            agentRun.objective.repositoryId,
            agentRun.createdById,
            path,
            agentRun.objective.repository.defaultBranch
          );

          snippets.push(
            `FILE ${path}:\n${content ?? "(file not found or unreadable)"}`
          );
        }

        messages.push({
          role: "assistant",
          content: JSON.stringify(step),
        });
        messages.push({
          role: "user",
          content: `File contents:\n\n${snippets.join("\n\n")}\n\nContinue with write_files or complete.`,
        });
        continue;
      }

      if (step.action === "write_files" && step.fileEdits?.length) {
        filesChanged += await applyAgentFileEdits(
          agentRun.objective.repositoryId,
          agentRun.createdById,
          branchName,
          step.fileEdits
        );

        messages.push({
          role: "assistant",
          content: JSON.stringify(step),
        });
        messages.push({
          role: "user",
          content: `Applied ${step.fileEdits.length} file edit(s). Continue with more write_files or complete with a report.`,
        });
        continue;
      }

      if (step.action === "complete") {
        report = step.report ?? "Implementation completed.";
        break;
      }
    }

    if (!report) {
      const summary = await chatCompletionWithUsage([
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `${userPrompt}\n\nSummarize what was implemented on branch ${branchName}. Files changed: ${filesChanged}.`,
        },
      ]);
      report = summary.content;
      totalPromptTokens += summary.promptTokens ?? 0;
      totalCompletionTokens += summary.completionTokens ?? 0;
    }

    let pullRequestUrl: string | null = null;
    let pullRequestNumber: number | null = null;

    if (filesChanged > 0) {
      const pullRequest = await createRepositoryPullRequest({
        repositoryId: agentRun.objective.repositoryId,
        userId: agentRun.createdById,
        branch: branchName,
        title: `[IntentHub] ${agentRun.plan.title}`,
        body: `${report}\n\nObjective: ${agentRun.objective.title}`,
        objectiveId: agentRun.objectiveId,
        agentRunId,
      });
      pullRequestUrl = pullRequest.url;
      pullRequestNumber = pullRequest.number;
    }

    const updated = await prisma.agentRun.update({
      where: { id: agentRunId },
      data: {
        status: "COMPLETED",
        prompt: userPrompt,
        output: report,
        branchName,
        model: agentRun.model ?? process.env.AI_CHAT_MODEL ?? "gpt-4o-mini",
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        filesChanged,
        pullRequestUrl,
        pullRequestNumber,
      },
    });

    await indexAgentRun(agentRunId);

    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent run failed";

    await prisma.agentRun.update({
      where: { id: agentRunId },
      data: {
        status: "FAILED",
        branchName,
        errorMessage: message,
        output: "",
      },
    });

    throw error;
  }
}
