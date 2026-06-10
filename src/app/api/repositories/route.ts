import {
  badRequest,
  demoReadonly,
  forbidden,
  getSessionUser,
  parseJsonBody,
  unauthorized,
} from "@/lib/api";
import { registerRepositoryWebhook, verifyUserOwnsRepository } from "@/lib/github";
import { enqueueSyncRepository } from "@/lib/jobs";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { rateLimitedResponse } from "@/lib/rate-limit";
import {
  omitWebhookSecret,
  omitWebhookSecretFromList,
} from "@/lib/repository-serializer";
import { connectRepoSchema } from "@/lib/validations";
import crypto from "crypto";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const repositories = await prisma.repository.findMany({
    where: {
      members: {
        some: { userId: user.id },
      },
    },
    include: {
      _count: {
        select: {
          objectives: true,
          commits: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(omitWebhookSecretFromList(repositories));
}

export async function POST(request: Request) {
  const limited = await rateLimitedResponse(request, "repo-connect", 10, 60_000);
  if (limited) return limited;

  const readonly = demoReadonly();
  if (readonly) return readonly;

  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { data: body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const parsed = connectRepoSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid repository data");
  }

  const ownsRepo = await verifyUserOwnsRepository(user.id, parsed.data.githubId);
  if (!ownsRepo) {
    return forbidden("You do not have access to this GitHub repository");
  }

  const existing = await prisma.repository.findUnique({
    where: { githubId: parsed.data.githubId },
    include: {
      members: {
        where: { userId: user.id },
      },
    },
  });

  if (existing) {
    if (existing.members.length > 0) {
      return NextResponse.json(omitWebhookSecret(existing));
    }

    await prisma.repositoryMember.create({
      data: {
        userId: user.id,
        repositoryId: existing.id,
        role: "MEMBER",
      },
    });

    return NextResponse.json(omitWebhookSecret(existing));
  }

  const webhookSecret = crypto.randomBytes(32).toString("hex");

  const repository = await prisma.repository.create({
    data: {
      githubId: parsed.data.githubId,
      owner: parsed.data.owner,
      name: parsed.data.name,
      fullName: parsed.data.fullName,
      defaultBranch: parsed.data.defaultBranch ?? "main",
      webhookSecret,
      members: {
        create: {
          userId: user.id,
          role: "OWNER",
        },
      },
    },
  });

  let syncStatus: "success" | "failed" | "queued" = "queued";
  let syncError: string | undefined;
  let webhookStatus: "success" | "failed" | "skipped" = "skipped";
  let webhookError: string | undefined;

  try {
    await registerRepositoryWebhook(repository.id, user.id);
    webhookStatus = "success";
  } catch (error) {
    webhookStatus = "failed";
    webhookError = "Webhook registration failed";
    logger.error("repository connect webhook registration failed", {
      repositoryId: repository.id,
      error: error instanceof Error ? error.message : error,
    });
  }

  try {
    const handle = await enqueueSyncRepository(repository.id);
    syncStatus = handle ? "queued" : "success";
  } catch (error) {
    syncStatus = "failed";
    syncError = "Sync failed";
    logger.error("repository connect sync enqueue failed", {
      repositoryId: repository.id,
      error: error instanceof Error ? error.message : error,
    });
  }

  const refreshed = await prisma.repository.findUnique({
    where: { id: repository.id },
    include: {
      _count: {
        select: {
          objectives: true,
          commits: true,
        },
      },
    },
  });

  return NextResponse.json(
    {
      ...omitWebhookSecret(refreshed!),
      syncStatus,
      syncError,
      webhookStatus,
      webhookError,
    },
    { status: 201 }
  );
}
