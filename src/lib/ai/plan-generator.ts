import { chatCompletionJson } from "@/lib/ai/provider";
import { buildRagContext } from "@/lib/ai/rag";
import { listRepositoryFilePaths } from "@/lib/github/agent-tools";
import { prisma } from "@/lib/prisma";

export type GeneratedPlan = {
  title: string;
  description: string;
  approach: string;
};

type PlanGenerationResult = {
  plans: GeneratedPlan[];
};

export async function generatePlansForObjective(params: {
  objectiveId: string;
  userId: string;
  model?: string;
}) {
  const objective = await prisma.objective.findUnique({
    where: { id: params.objectiveId },
    include: { repository: true },
  });

  if (!objective) {
    throw new Error("Objective not found");
  }

  const [ragContext, commits] = await Promise.all([
    buildRagContext(
      objective.repositoryId,
      `${objective.title}\n${objective.description}`
    ),
    prisma.gitCommit.findMany({
      where: { repositoryId: objective.repositoryId },
      take: 10,
      orderBy: { committedAt: "desc" },
      select: { message: true, sha: true },
    }),
  ]);

  let filePaths: string[] = [];
  try {
    filePaths = await listRepositoryFilePaths(
      objective.repositoryId,
      params.userId,
      objective.repository.defaultBranch,
      200
    );
  } catch {
    filePaths = [];
  }

  const context = [
    `Repository: ${objective.repository.fullName}`,
    `Objective: ${objective.title}`,
    objective.description,
    "",
    "Recent commits:",
    ...commits.map((c) => `- ${c.sha.slice(0, 7)}: ${c.message.split("\n")[0]}`),
    "",
    "File tree (sample):",
    filePaths.slice(0, 100).join("\n") || "(unavailable)",
    "",
    "Repository knowledge:",
    ragContext || "(none indexed yet)",
  ].join("\n");

  const result = await chatCompletionJson<PlanGenerationResult>(
    [
      {
        role: "system",
        content:
          "You generate competing implementation plans for software objectives. Return JSON with key plans: an array of 2-3 objects, each with title, description, and approach (concrete technical steps). Plans must be meaningfully different approaches.",
      },
      {
        role: "user",
        content: context,
      },
    ]
  );

  if (!result.plans?.length) {
    throw new Error("AI returned no plans");
  }

  return result.plans.slice(0, 3);
}
