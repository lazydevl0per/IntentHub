import {
  demoReadonly,
  getSessionUser,
  notFound,
  requireRepoAccess,
  unauthorized,
} from "@/lib/api";
import { streamRepositoryChatWithCitations } from "@/lib/ai/rag";
import { getDemoChatSessions } from "@/lib/demo/fixtures";
import { isDemoMode } from "@/lib/demo";
import { chatSchema } from "@/lib/validations";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const member = await requireRepoAccess(id, user.id);
  if (!member) return notFound();

  if (isDemoMode()) {
    return NextResponse.json(getDemoChatSessions(id));
  }

  const sessions = await prisma.chatSession.findMany({
    where: { repositoryId: id, userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 20,
    include: {
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json(sessions);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const readonly = demoReadonly();
  if (readonly) return readonly;

  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const member = await requireRepoAccess(id, user.id);
  if (!member) return notFound();

  const body = await request.json();
  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid chat message" }, { status: 400 });
  }

  let sessionId = parsed.data.sessionId;

  if (sessionId) {
    const existing = await prisma.chatSession.findFirst({
      where: { id: sessionId, repositoryId: id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
  } else {
    const session = await prisma.chatSession.create({
      data: {
        repositoryId: id,
        userId: user.id,
        title: parsed.data.message.slice(0, 80),
      },
    });
    sessionId = session.id;
  }

  await prisma.chatMessage.create({
    data: {
      sessionId,
      role: "user",
      content: parsed.data.message,
    },
  });

  const priorMessages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  const history = priorMessages
    .slice(0, -1)
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  const encoder = new TextEncoder();
  const sessionIdHeader = sessionId;

  const stream = new ReadableStream({
    async start(controller) {
      let assistantContent = "";

      try {
        const { content, citations } = streamRepositoryChatWithCitations({
          repositoryId: id,
          message: parsed.data.message,
          history,
        });

        for await (const chunk of content) {
          assistantContent += chunk;
          controller.enqueue(encoder.encode(chunk));
        }

        const citationList = await citations;
        const citationBlock = `\n\n[[CITATIONS]]${JSON.stringify(citationList)}[[/CITATIONS]]`;
        controller.enqueue(encoder.encode(citationBlock));

        await prisma.chatMessage.create({
          data: {
            sessionId: sessionIdHeader,
            role: "assistant",
            content: assistantContent,
          },
        });

        await prisma.chatSession.update({
          where: { id: sessionIdHeader },
          data: { updatedAt: new Date() },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Chat failed";
        controller.enqueue(encoder.encode(message));
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Chat-Session-Id": sessionId,
    },
  });
}
