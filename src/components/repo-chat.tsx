"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Message = {
  role: "user" | "assistant";
  content: string;
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

export function RepoChat({ repositoryId }: { repositoryId: string }) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/repositories/${repositoryId}/chat`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setSessions)
      .catch(() => setSessions([]));
  }, [repositoryId]);

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

  function startNewChat() {
    setSessionId(null);
    setMessages([]);
  }

  async function sendMessage(message: string) {
    if (!message.trim() || loading) return;

    const userMessage: Message = { role: "user", content: message };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    const res = await fetch(`/api/repositories/${repositoryId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        sessionId: sessionId ?? undefined,
      }),
    });

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
          <Button variant="outline" size="sm" onClick={startNewChat}>
            New chat
          </Button>
        </div>
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
              disabled={loading}
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
            disabled={loading}
          />
          <Button type="submit" disabled={loading}>
            {loading ? "..." : "Send"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
