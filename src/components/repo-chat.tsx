"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DemoReadonlyNotice } from "@/components/demo-readonly";

type Message = {
  role: "user" | "assistant";
  content: string;
  citations?: Array<{ entityType: string; entityId: string; title: string }>;
};

type ChatSession = {
  id: string;
  title: string;
  updatedAt: string;
  _count: { messages: number };
};

const suggestions = [
  "Why was this architecture chosen?",
  "What alternatives were rejected?",
  "Which objectives are still active?",
];

function parseAssistantStream(raw: string) {
  const marker = "\n\n[[CITATIONS]]";
  const endMarker = "[[/CITATIONS]]";
  const start = raw.indexOf(marker);
  if (start === -1) {
    return { content: raw, citations: [] as Message["citations"] };
  }

  const end = raw.indexOf(endMarker, start);
  if (end === -1) {
    return { content: raw.slice(0, start), citations: [] };
  }

  const content = raw.slice(0, start);
  try {
    const citations = JSON.parse(
      raw.slice(start + marker.length, end)
    ) as Message["citations"];
    return { content, citations: citations ?? [] };
  } catch {
    return { content, citations: [] };
  }
}

export function RepoChat({
  repositoryId,
  demoMode,
}: {
  repositoryId: string;
  demoMode?: boolean;
}) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatError, setChatError] = useState("");

  async function loadSession(id: string) {
    const res = await fetch(
      `/api/repositories/${repositoryId}/chat/sessions/${id}`
    );
    if (!res.ok) return;

    const data = await res.json();
    setSessionId(data.id);
    setMessages(
      data.messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }))
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
                      {message.citations.map((citation) => (
                        <span
                          key={`${citation.entityType}-${citation.entityId}`}
                          className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800"
                        >
                          {citation.entityType}: {citation.title}
                        </span>
                      ))}
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
