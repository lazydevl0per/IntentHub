import { verifyGitHubWebhook } from "@/lib/github";
import { enqueueGitHubWebhook } from "@/lib/jobs";
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

  return NextResponse.json({
    ok: true,
    delivery,
    event,
  });
}
