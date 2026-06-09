import { chatCompletionWithUsage, type ChatMessage } from "@/lib/ai/provider";
import { createRepositoryBranch } from "@/lib/github";
import { indexAgentRun } from "@/lib/indexing";
import { prisma } from "@/lib/prisma";

const DEFAULT_SYSTEM_PROMPT = `You are an AI software development agent working inside IntentHub.
Analyze the objective and plan, then produce a detailed implementation report including:
- recommended steps
- files or areas likely to change
- risks and tradeoffs
- testing approach

Do not write code in this version. Focus on a clear, actionable plan the team can implement on the branch you are assigned.`;

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
    "Produce an implementation report for this plan on the assigned branch.",
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
    agentRun.branchName ??
    buildAgentBranchName(agentRun.plan.title);

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
      agentRun.objective.repository.agentSystemPrompt ??
      DEFAULT_SYSTEM_PROMPT;

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

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const result = await chatCompletionWithUsage(
      messages,
      agentRun.model ?? undefined
    );

    const updated = await prisma.agentRun.update({
      where: { id: agentRunId },
      data: {
        status: "COMPLETED",
        prompt: userPrompt,
        output: result.content,
        branchName,
        model: agentRun.model ?? process.env.AI_CHAT_MODEL ?? "gpt-4o-mini",
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
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
