import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createEmbedding, streamChatCompletion, type ChatMessage } from "@/lib/ai/provider";
import { fullTextSearch } from "@/lib/search";
import { DocumentEntityType } from "@prisma/client";

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

export async function buildRagContext(repositoryId: string, query: string) {
  const [vectorResults, ftsResults] = await Promise.all([
    vectorSearch(repositoryId, query),
    fullTextSearch(repositoryId, query, 5),
  ]);

  const contextParts: string[] = [];

  for (const result of vectorResults) {
    contextParts.push(
      `[${result.entityType}:${result.entityId}] ${result.content}`
    );
  }

  for (const result of ftsResults) {
    contextParts.push(
      `[${result.entity_type}:${result.entity_id}] ${result.title}: ${result.content}`
    );
  }

  return contextParts.join("\n\n");
}

export async function* streamRepositoryChat(params: {
  repositoryId: string;
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  const context = await buildRagContext(params.repositoryId, params.message);

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
