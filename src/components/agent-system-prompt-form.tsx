"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function AgentSystemPromptForm({
  repositoryId,
  initialPrompt,
}: {
  repositoryId: string;
  initialPrompt: string | null;
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(initialPrompt ?? "");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setLoading(true);
    setSaved(false);

    const res = await fetch(`/api/repositories/${repositoryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentSystemPrompt: prompt || null,
      }),
    });

    setLoading(false);

    if (res.ok) {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Custom system prompt for AI agents on this repository..."
        rows={6}
      />
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={loading} size="sm">
          {loading ? "Saving..." : "Save prompt"}
        </Button>
        {saved && (
          <span className="text-sm text-zinc-500">Saved</span>
        )}
      </div>
    </div>
  );
}
