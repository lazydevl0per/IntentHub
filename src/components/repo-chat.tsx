"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const suggestions = [
  "Why was this architecture chosen?",
  "What alternatives were rejected?",
  "Which objectives are still active?",
];

export function RepoChat({ repositoryId }: { repositoryId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

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
        history: messages,
      }),
    });

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
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg">Ask Repository</CardTitle>
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
