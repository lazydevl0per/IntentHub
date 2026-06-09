import { chatCompletionJson } from "@/lib/ai/provider";
import { getCommitStats } from "@/lib/github";
import { indexCommit } from "@/lib/indexing";
import { prisma } from "@/lib/prisma";

type InsightResult = {
  intent: string;
  archImpact: string;
  perfImpact: string;
  testStatus: string;
};

async function findLinkedObjectiveId(
  repositoryId: string,
  sha: string
) {
  const decision = await prisma.decision.findFirst({
    where: {
      objective: { repositoryId },
      OR: [
        { linkedCommitSha: sha },
        { linkedCommitSha: { startsWith: sha.slice(0, 7) } },
      ],
    },
    select: { objectiveId: true },
  });

  if (decision) {
    return decision.objectiveId;
  }

  const agentRun = await prisma.agentRun.findFirst({
    where: {
      objective: { repositoryId },
      OR: [
        { branchName: { contains: sha.slice(0, 7) } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: { objectiveId: true },
  });

  return agentRun?.objectiveId ?? null;
}

export async function generateCommitInsight(
  repositoryId: string,
  sha: string
) {
  const commit = await prisma.gitCommit.findUnique({
    where: {
      repositoryId_sha: { repositoryId, sha },
    },
  });

  if (!commit) {
    throw new Error("Commit not found");
  }

  const objectiveId = await findLinkedObjectiveId(repositoryId, sha);

  let objectiveContext = "";
  if (objectiveId) {
    const objective = await prisma.objective.findUnique({
      where: { id: objectiveId },
      include: { plans: { where: { status: "SELECTED" }, take: 1 } },
    });
    if (objective) {
      objectiveContext = `Linked objective: ${objective.title}. ${objective.description}`;
      if (objective.plans[0]) {
        objectiveContext += ` Selected plan: ${objective.plans[0].title}.`;
      }
    }
  }

  let statsContext = "";
  try {
    const stats = await getCommitStats(repositoryId, sha);
    if (stats) {
      statsContext = `Diff stats: +${stats.additions} -${stats.deletions} across ${stats.filesChanged} files.`;
    }
  } catch {
  }

  const result = await chatCompletionJson<InsightResult>([
    {
      role: "system",
      content:
        "You analyze git commits for intent and impact. Return JSON with keys: intent, archImpact, perfImpact, testStatus. Use concise phrases. testStatus examples: Passed, Unknown, Not run.",
    },
    {
      role: "user",
      content: [
        `Commit ${sha.slice(0, 7)} by ${commit.author}`,
        `Message: ${commit.message}`,
        statsContext,
        objectiveContext,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ]);

  const insight = await prisma.commitInsight.upsert({
    where: {
      repositoryId_sha: { repositoryId, sha },
    },
    create: {
      repositoryId,
      sha,
      objectiveId,
      intent: result.intent,
      archImpact: result.archImpact,
      perfImpact: result.perfImpact,
      testStatus: result.testStatus,
    },
    update: {
      objectiveId,
      intent: result.intent,
      archImpact: result.archImpact,
      perfImpact: result.perfImpact,
      testStatus: result.testStatus,
    },
  });

  await indexCommit(repositoryId, sha);

  return insight;
}
