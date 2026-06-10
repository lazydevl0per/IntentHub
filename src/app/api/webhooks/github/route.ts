import { badRequest } from "@/lib/api";
import { verifyGitHubWebhook } from "@/lib/github";
import { enqueueGitHubWebhook } from "@/lib/jobs";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { rateLimitedResponse } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const limited = await rateLimitedResponse(request, "github-webhook", 120, 60_000);
  if (limited) return limited;

  const payload = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const event = request.headers.get("x-github-event");
  const delivery = request.headers.get("x-github-delivery");

  if (!event) {
    return badRequest("Missing event header");
  }

  let data: {
    repository?: { id: number };
    ref?: string;
    ref_type?: string;
    action?: string;
    commits?: Array<{
      id: string;
      message: string;
      author: { name: string };
      timestamp: string;
    }>;
    pull_request?: {
      id: number;
      number: number;
      title: string;
      state: string;
      merged: boolean;
      merged_at: string | null;
      merge_commit_sha: string | null;
      html_url: string;
      head: { ref: string };
      base: { ref: string };
    };
    check_run?: {
      name: string;
      conclusion: string | null;
      status: string;
      head_branch: string;
      output?: { summary?: string | null; title?: string | null };
    };
  };

  try {
    data = JSON.parse(payload);
  } catch {
    return badRequest("Invalid JSON payload");
  }

  if (!data.repository?.id) {
    return badRequest("Invalid payload");
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
    const handle = await enqueueGitHubWebhook({
      repositoryId: repository.id,
      event: "push",
      ref: data.ref,
      commits: data.commits,
    });

    return NextResponse.json(
      {
        ok: true,
        delivery,
        event,
        queued: Boolean(handle),
        runId: handle?.id,
      },
      { status: handle ? 202 : 200 }
    );
  }

  if (event === "create" && data.ref && data.ref_type) {
    const handle = await enqueueGitHubWebhook({
      repositoryId: repository.id,
      event: "create",
      ref: data.ref,
      refType: data.ref_type,
    });

    return NextResponse.json(
      {
        ok: true,
        delivery,
        event,
        queued: Boolean(handle),
        runId: handle?.id,
      },
      { status: handle ? 202 : 200 }
    );
  }

  if (event === "delete" && data.ref && data.ref_type) {
    const handle = await enqueueGitHubWebhook({
      repositoryId: repository.id,
      event: "delete",
      ref: data.ref,
      refType: data.ref_type,
    });

    return NextResponse.json(
      {
        ok: true,
        delivery,
        event,
        queued: Boolean(handle),
        runId: handle?.id,
      },
      { status: handle ? 202 : 200 }
    );
  }

  if (event === "pull_request" && data.action && data.pull_request) {
    const handle = await enqueueGitHubWebhook({
      repositoryId: repository.id,
      event: "pull_request",
      pullRequest: {
        action: data.action,
        pull_request: data.pull_request,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        delivery,
        event,
        queued: Boolean(handle),
        runId: handle?.id,
      },
      { status: handle ? 202 : 200 }
    );
  }

  if (event === "check_run" && data.action && data.check_run) {
    const handle = await enqueueGitHubWebhook({
      repositoryId: repository.id,
      event: "check_run",
      checkRun: {
        action: data.action,
        check_run: data.check_run,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        delivery,
        event,
        queued: Boolean(handle),
        runId: handle?.id,
      },
      { status: handle ? 202 : 200 }
    );
  }

  logger.info("github webhook ignored", { event, delivery });

  return NextResponse.json({
    ok: true,
    delivery,
    event,
  });
}
