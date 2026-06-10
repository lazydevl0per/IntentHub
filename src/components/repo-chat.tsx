"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DemoReadonlyNotice } from "@/components/demo-readonly";

type Citation = {
  entityType: string;
  entityId: string;
  title: string;
  href?: string | null;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
};

type ChatSession = {
  id: string;
  title: string;
  updatedAt: string;
  _count: { messages: number };
};

function parseAssistantStream(raw: string) {
  const marker = "\n\n[[CITATIONS]]";
  const endMarker = "[[/CITATIONS]]";
  const start = raw.indexOf(marker);
  if (start === -1) {
    return { content: raw, citations: [] as Citation[] };
  }

  const end = raw.indexOf(endMarker, start);
  if (end === -1) {
    return { content: raw.slice(0, start), citations: [] };
  }

  const content = raw.slice(0, start);
  try {
    const citations = JSON.parse(
      raw.slice(start + marker.length, end)
    ) as Citation[];
    return { content, citations: citations ?? [] };
  } catch {
    return { content, citations: [] };
  }
}

function isKnowledgeStale(lastSyncedAt: string | null | undefined) {
  if (!lastSyncedAt) return true;
  const synced = new Date(lastSyncedAt).getTime();
  if (Number.isNaN(synced)) return true;
  return Date.now() - synced > 24 * 60 * 60 * 1000;
}

function buildSuggestions(
  objectives: Array<{ status: string }>
) {
  const suggestions = ["What changed recently?"];

  if (objectives.some((objective) => objective.status === "COMPLETED")) {
    suggestions.push("Why was this architecture chosen?");
  }
  if (objectives.length > 0) {
    suggestions.push("What alternatives were rejected?");
  }
  if (
    objectives.some(
      (objective) =>
        objective.status === "ACTIVE" || objective.status === "DRAFT"
    )
  ) {
    suggestions.push("Which objectives are still active?");
  }

  return suggestions.slice(0, 4);
}

export function RepoChat({
  repositoryId,
  demoMode,
  lastSyncedAt,
  objectives = [],
}: {
  repositoryId: string;
  demoMode?: boolean;
  lastSyncedAt?: string | null;
  objectives?: Array<{ status: string }>;
}) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatError, setChatError] = useState("");

  const suggestions = useMemo(
    () => buildSuggestions(objectives),
    [objectives]
  );
  const knowledgeStale = isKnowledgeStale(lastSyncedAt);

  async function loadSession(id: string) {
    const res = await fetch(
      `/api/repositories/${repositoryId}/chat/sessions/${id}`
    );
    if (!res.ok) return;

    const data = await res.json();
    setSessionId(data.id);
    setMessages(
      data.messages.map(
        (m: {
          role: string;
          content: string;
          citations?: Citation[] | null;
        }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          citations: (m.citations as Citation[] | null) ?? undefined,
        })
      )
    );
  }

  useEffect(() => {
    fetch(`/api/repositories/${repositoryId}/chat`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ChatSession[]) => {
        setSessions(data);
        if (demoMode && data.length > 0) {
          loadSession(data[0].id);
        }
      })
      .catch(() => setSessions([]));
  }, [repositoryId, demoMode]);

  function startNewChat() {
    if (demoMode) return;
    setSessionId(null);
    setMessages([]);
  }

  async function sendMessage(message: string) {
    if (!message.trim() || loading || demoMode) return;

    const userMessage: Message = { role: "user", content: message };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setChatError("");

    const res = await fetch(`/api/repositories/${repositoryId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        sessionId: sessionId ?? undefined,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      setChatError(
        typeof errData.error === "string"
          ? errData.error
          : "Failed to send message"
      );
      setMessages((prev) => prev.slice(0, -1));
      setLoading(false);
      return;
    }

    const newSessionId = res.headers.get("X-Chat-Session-Id");
    if (newSessionId && !sessionId) {
      setSessionId(newSessionId);
    }

    const reader = res.body?.getReader();
    let assistantContent = "";

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    if (reader) {
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantContent += decoder.decode(value);
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: assistantContent,
          };
          return next;
        });
      }
    }

    setLoading(false);

    const parsed = parseAssistantStream(assistantContent);
    setMessages((prev) => {
      const next = [...prev];
      next[next.length - 1] = {
        role: "assistant",
        content: parsed.content,
        citations: parsed.citations,
      };
      return next;
    });

    fetch(`/api/repositories/${repositoryId}/chat`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setSessions)
      .catch(() => {});
  }

  return (
    <Card className="h-full">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg">Ask Repository</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={startNewChat}
            disabled={demoMode}
          >
            New chat
          </Button>
        </div>
        {demoMode && <DemoReadonlyNotice />}
        {knowledgeStale && !demoMode && (
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Knowledge may be stale.{" "}
            <Link
              href={`/repositories/${repositoryId}/settings`}
              className="underline"
            >
              Sync or reindex
            </Link>{" "}
            for better answers.
          </p>
        )}
        {chatError && <p className="text-sm text-red-600">{chatError}</p>}
        {sessions.length > 0 && (
          <ScrollArea className="h-20">
            <div className="flex flex-wrap gap-2">
              {sessions.map((session) => (
                <Button
                  key={session.id}
                  variant={sessionId === session.id ? "default" : "outline"}
                  size="sm"
                  className="max-w-full truncate"
                  onClick={() => loadSession(session.id)}
                >
                  {session.title}
                </Button>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion}
              variant="outline"
              size="sm"
              onClick={() => sendMessage(suggestion)}
              disabled={loading || demoMode}
            >
              {suggestion}
            </Button>
          ))}
        </div>
        <ScrollArea className="h-64 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="space-y-4">
            {messages.length === 0 && (
              <p className="text-sm text-zinc-500">
                Ask questions about objectives, plans, decisions, and commits.
              </p>
            )}
            {messages.map((message, index) => (
              <div
                key={index}
                className={
                  message.role === "user"
                    ? "ml-8 rounded-lg bg-zinc-100 p-3 text-sm dark:bg-zinc-800"
                    : "mr-8 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800"
                }
              >
                <p className="mb-1 text-xs font-medium uppercase text-zinc-500">
                  {message.role}
                </p>
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.citations && message.citations.length > 0 && (
                  <div className="mt-3 border-t border-zinc-200 pt-2 dark:border-zinc-700">
                    <p className="mb-1 text-xs font-medium uppercase text-zinc-500">
                      Sources
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {message.citations.map((citation) =>
                        citation.href ? (
                          <Link
                            key={`${citation.entityType}-${citation.entityId}`}
                            href={citation.href}
                            className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs underline dark:bg-zinc-800"
                          >
                            {citation.title}
                          </Link>
                        ) : (
                          <span
                            key={`${citation.entityType}-${citation.entityId}`}
                            className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800"
                          >
                            {citation.title}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Why was Redis added?"
            disabled={loading || demoMode}
          />
          <Button type="submit" disabled={loading || demoMode}>
            {loading ? "..." : "Send"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
