import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createEmbedding, streamChatCompletion, type ChatMessage } from "@/lib/ai/provider";
import { fullTextSearch } from "@/lib/search";
import { DocumentEntityType } from "@prisma/client";

export type RagCitation = {
  entityType: string;
  entityId: string;
  title: string;
};

function chunkText(text: string, maxLength = 1000) {
  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    let splitAt = remaining.lastIndexOf("\n", maxLength);
    if (splitAt < maxLength / 2) {
      splitAt = maxLength;
    }

    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  return chunks.filter(Boolean);
}

export async function indexEntityContent(params: {
  repositoryId: string;
  entityType: DocumentEntityType;
  entityId: string;
  content: string;
}) {
  const chunks = chunkText(params.content);

  await prisma.documentChunk.deleteMany({
    where: {
      entityType: params.entityType,
      entityId: params.entityId,
    },
  });

  for (const chunk of chunks) {
    const embedding = await createEmbedding(chunk);
    const vectorLiteral = `[${embedding.join(",")}]`;

    await prisma.$executeRaw`
      INSERT INTO "DocumentChunk" (id, "repositoryId", "entityType", "entityId", content, embedding, "createdAt", "updatedAt")
      VALUES (
        ${crypto.randomUUID()},
        ${params.repositoryId},
        ${params.entityType}::"DocumentEntityType",
        ${params.entityId},
        ${chunk},
        ${vectorLiteral}::vector,
        NOW(),
        NOW()
      )
    `;
  }
}

export async function vectorSearch(
  repositoryId: string,
  query: string,
  limit = 8
) {
  const embedding = await createEmbedding(query);
  const vectorLiteral = `[${embedding.join(",")}]`;

  const results = await prisma.$queryRaw<
    Array<{
      id: string;
      entityType: DocumentEntityType;
      entityId: string;
      content: string;
      distance: number;
    }>
  >`
    SELECT id, "entityType", "entityId", content,
      embedding <=> ${vectorLiteral}::vector as distance
    FROM "DocumentChunk"
    WHERE "repositoryId" = ${repositoryId}
    ORDER BY distance ASC
    LIMIT ${limit}
  `;

  return results;
}

function citationKey(entityType: string, entityId: string) {
  return `${entityType}:${entityId}`;
}

const entityTypeLabels: Record<string, string> = {
  OBJECTIVE: "Objective",
  PLAN: "Plan",
  AGENT_RUN: "Agent Run",
  EVALUATION: "Evaluation",
  DECISION: "Decision",
  COMMIT: "Commit",
};

async function resolveCitationTitle(
  entityType: string,
  entityId: string
): Promise<string> {
  const label = entityTypeLabels[entityType] ?? entityType;

  try {
    switch (entityType) {
      case "OBJECTIVE": {
        const row = await prisma.objective.findUnique({
          where: { id: entityId },
          select: { title: true },
        });
        return row ? `${label}: ${row.title}` : label;
      }
      case "PLAN": {
        const row = await prisma.plan.findUnique({
          where: { id: entityId },
          select: { title: true },
        });
        return row ? `${label}: ${row.title}` : label;
      }
      case "AGENT_RUN": {
        const row = await prisma.agentRun.findUnique({
          where: { id: entityId },
          select: { agentName: true },
        });
        return row ? `${label}: ${row.agentName}` : label;
      }
      case "EVALUATION": {
        const row = await prisma.evaluation.findUnique({
          where: { id: entityId },
          select: { type: true, score: true },
        });
        return row ? `${label}: ${row.type} (${row.score})` : label;
      }
      case "DECISION":
        return `${label}`;
      case "COMMIT": {
        const row = await prisma.gitCommit.findUnique({
          where: { id: entityId },
          select: { sha: true, message: true },
        });
        if (row) {
          return `${label}: ${row.sha.slice(0, 7)} — ${row.message.slice(0, 60)}`;
        }
        const bySha = await prisma.gitCommit.findFirst({
          where: { sha: { startsWith: entityId.slice(0, 7) } },
          select: { sha: true, message: true },
        });
        return bySha
          ? `${label}: ${bySha.sha.slice(0, 7)} — ${bySha.message.slice(0, 60)}`
          : label;
      }
      default:
        return label;
    }
  } catch {
    return label;
  }
}

async function enrichCitations(citations: Map<string, RagCitation>) {
  const entries = Array.from(citations.entries());
  const resolved = await Promise.all(
    entries.map(async ([key, citation]) => {
      const title = await resolveCitationTitle(
        citation.entityType,
        citation.entityId
      );
      return [key, { ...citation, title }] as const;
    })
  );

  return new Map(resolved);
}

export async function buildRagContextWithCitations(
  repositoryId: string,
  query: string
) {
  const [vectorResults, ftsResults] = await Promise.all([
    vectorSearch(repositoryId, query),
    fullTextSearch(repositoryId, query, 5),
  ]);

  const contextParts: string[] = [];
  const citations = new Map<string, RagCitation>();

  for (const result of vectorResults) {
    contextParts.push(
      `[${result.entityType}:${result.entityId}] ${result.content}`
    );
    citations.set(citationKey(result.entityType, result.entityId), {
      entityType: result.entityType,
      entityId: result.entityId,
      title: entityTypeLabels[result.entityType] ?? result.entityType,
    });
  }

  for (const result of ftsResults) {
    contextParts.push(
      `[${result.entity_type}:${result.entity_id}] ${result.title}: ${result.content}`
    );
    citations.set(citationKey(result.entity_type, result.entity_id), {
      entityType: result.entity_type,
      entityId: result.entity_id,
      title: result.title,
    });
  }

  const enriched = await enrichCitations(citations);

  return {
    context: contextParts.join("\n\n"),
    citations: Array.from(enriched.values()),
  };
}

export async function buildRagContext(repositoryId: string, query: string) {
  const { context } = await buildRagContextWithCitations(repositoryId, query);
  return context;
}

export async function* streamRepositoryChat(params: {
  repositoryId: string;
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  const { content } = streamRepositoryChatWithCitations(params);
  yield* content;
}

export type StreamRepositoryChatResult = {
  content: AsyncGenerator<string, void, unknown>;
  citations: Promise<RagCitation[]>;
};

export function streamRepositoryChatWithCitations(params: {
  repositoryId: string;
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}): StreamRepositoryChatResult {
  let resolveCitations: (citations: RagCitation[]) => void = () => {};
  const citationsPromise = new Promise<RagCitation[]>((resolve) => {
    resolveCitations = resolve;
  });

  async function* generator() {
    const { context, citations } = await buildRagContextWithCitations(
      params.repositoryId,
      params.message
    );

    resolveCitations(citations);

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `You are IntentHub, an AI assistant that answers questions about a software repository's objectives, plans, decisions, and implementation history. Use only the provided context. If the context is insufficient, say so clearly.

Context:
${context || "No repository knowledge found yet."}`,
      },
    ];

    if (params.history) {
      for (const item of params.history) {
        messages.push({ role: item.role, content: item.content });
      }
    }

    messages.push({ role: "user", content: params.message });

    for await (const chunk of streamChatCompletion(messages)) {
      yield chunk;
    }
  }

  return {
    content: generator(),
    citations: citationsPromise,
  };
}
