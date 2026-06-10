import type { RagCitation } from "@/lib/ai/rag";
import { prisma } from "@/lib/prisma";

export async function resolveCitationHref(
  entityType: string,
  entityId: string
): Promise<string | null> {
  switch (entityType) {
    case "OBJECTIVE":
      return `/objectives/${entityId}`;
    case "PLAN": {
      const plan = await prisma.plan.findUnique({
        where: { id: entityId },
        select: { objectiveId: true },
      });
      return plan ? `/objectives/${plan.objectiveId}` : null;
    }
    case "AGENT_RUN": {
      const run = await prisma.agentRun.findUnique({
        where: { id: entityId },
        select: { objectiveId: true },
      });
      return run ? `/objectives/${run.objectiveId}` : null;
    }
    case "EVALUATION": {
      const evaluation = await prisma.evaluation.findUnique({
        where: { id: entityId },
        select: { objectiveId: true },
      });
      return evaluation ? `/objectives/${evaluation.objectiveId}` : null;
    }
    case "DECISION": {
      const decision = await prisma.decision.findUnique({
        where: { id: entityId },
        select: { objectiveId: true },
      });
      return decision ? `/objectives/${decision.objectiveId}` : null;
    }
    case "COMMIT": {
      const commit = await prisma.gitCommit.findUnique({
        where: { id: entityId },
        select: { repositoryId: true },
      });
      return commit ? `/repositories/${commit.repositoryId}` : null;
    }
    default:
      return null;
  }
}

export async function enrichCitationsWithHref(
  citations: RagCitation[]
): Promise<RagCitation[]> {
  return Promise.all(
    citations.map(async (citation) => ({
      ...citation,
      href: await resolveCitationHref(citation.entityType, citation.entityId),
    }))
  );
}
