import {
  badRequest,
  demoReadonly,
  getSessionUser,
  unauthorized,
} from "@/lib/api";
import { registerRepositoryWebhook } from "@/lib/github";
import { enqueueSyncRepository } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";
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

  return NextResponse.json(repositories);
}

export async function POST(request: Request) {
  const readonly = demoReadonly();
  if (readonly) return readonly;

  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await request.json();
  const parsed = connectRepoSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid repository data");
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
      return NextResponse.json(existing);
    }

    await prisma.repositoryMember.create({
      data: {
        userId: user.id,
        repositoryId: existing.id,
        role: "MEMBER",
      },
    });

    return NextResponse.json(existing);
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
    webhookError = error instanceof Error ? error.message : "Webhook registration failed";
    console.error("[webhook] repository connect registration failed", {
      repositoryId: repository.id,
      error: webhookError,
    });
  }

  try {
    const handle = await enqueueSyncRepository(repository.id);
    syncStatus = handle ? "queued" : "success";
  } catch (error) {
    syncStatus = "failed";
    syncError = error instanceof Error ? error.message : "Sync failed";
    console.error("[sync] repository connect enqueue failed", {
      repositoryId: repository.id,
      error: syncError,
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
    { ...refreshed, syncStatus, syncError, webhookStatus, webhookError },
    { status: 201 }
  );
}
