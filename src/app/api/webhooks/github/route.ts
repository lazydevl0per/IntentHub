import {
  handleBranchCreateWebhook,
  handleBranchDeleteWebhook,
  handlePushWebhook,
  verifyGitHubWebhook,
} from "@/lib/github";
import { indexCommit } from "@/lib/indexing";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const event = request.headers.get("x-github-event");
  const delivery = request.headers.get("x-github-delivery");

  if (!event) {
    return NextResponse.json({ error: "Missing event header" }, { status: 400 });
  }

  const data = JSON.parse(payload) as {
    repository?: { id: number };
    ref?: string;
    ref_type?: string;
    commits?: Array<{
      id: string;
      message: string;
      author: { name: string };
      timestamp: string;
    }>;
  };

  if (!data.repository?.id) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const repository = await prisma.repository.findUnique({
    where: { githubId: data.repository.id },
  });

  if (!repository) {
    return NextResponse.json({ error: "Repository not found" }, { status: 404 });
  }

  const secret =
    repository.webhookSecret ?? process.env.GITHUB_WEBHOOK_SECRET ?? "";

  if (!secret || !verifyGitHubWebhook(payload, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event === "push" && data.ref && data.commits) {
    await handlePushWebhook(repository.id, {
      ref: data.ref,
      commits: data.commits,
    });

    for (const commit of data.commits) {
      try {
        await indexCommit(repository.id, commit.id);
      } catch {
      }
    }
  } else if (event === "create" && data.ref && data.ref_type) {
    await handleBranchCreateWebhook(repository.id, {
      ref: data.ref,
      ref_type: data.ref_type,
    });
  } else if (event === "delete" && data.ref && data.ref_type) {
    await handleBranchDeleteWebhook(repository.id, {
      ref: data.ref,
      ref_type: data.ref_type,
    });
  }

  return NextResponse.json({
    ok: true,
    delivery,
    event,
  });
}
