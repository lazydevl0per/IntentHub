import { chatCompletionJson } from "@/lib/ai/provider";
import { prisma } from "@/lib/prisma";

type EvaluationResult = {
  score: number;
  summary: string;
};

export async function generateAgentRunEvaluation(params: {
  agentRunId: string;
  model?: string;
}) {
  const agentRun = await prisma.agentRun.findUnique({
    where: { id: params.agentRunId },
    include: {
      plan: true,
      objective: true,
    },
  });

  if (!agentRun) {
    throw new Error("Agent run not found");
  }

  const context = [
    `Objective: ${agentRun.objective.title}`,
    agentRun.objective.description,
    "",
    agentRun.plan
      ? `Plan: ${agentRun.plan.title}\n${agentRun.plan.description}\nApproach: ${agentRun.plan.approach}`
      : "",
    "",
    `Agent status: ${agentRun.status}`,
    `Files changed: ${agentRun.filesChanged ?? 0}`,
    `Pull request: ${agentRun.pullRequestUrl ?? "none"}`,
    "",
    "Agent output:",
    agentRun.output || "(no output)",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await chatCompletionJson<EvaluationResult>(
    [
      {
        role: "system",
        content:
          "You evaluate AI agent implementation attempts. Return JSON with score (0-100 integer) and summary (2-4 sentences covering quality, completeness, and risks).",
      },
      {
        role: "user",
        content: context,
      },
    ]
  );

  return {
    type: "QUALITY" as const,
    score: Math.min(100, Math.max(0, Math.round(result.score))),
    summary: result.summary,
  };
}
