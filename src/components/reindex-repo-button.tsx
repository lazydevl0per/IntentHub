"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ReindexRepositoryButton({
  repositoryId,
  demoMode,
}: {
  repositoryId: string;
  demoMode?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleReindex() {
    setLoading(true);
    setMessage(null);

    const res = await fetch(`/api/repositories/${repositoryId}/reindex`, {
      method: "POST",
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "Reindex failed");
      return;
    }

    const data = await res.json();
    setMessage(
      data.reindexStatus === "queued"
        ? "Reindex queued. Search index will refresh shortly."
        : "Repository reindexed."
    );
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        onClick={handleReindex}
        disabled={loading || demoMode}
        title={demoMode ? "Demo mode — read only" : undefined}
      >
        {loading ? "Reindexing..." : "Reindex search"}
      </Button>
      {message && <p className="text-sm text-zinc-500">{message}</p>}
    </div>
  );
}
