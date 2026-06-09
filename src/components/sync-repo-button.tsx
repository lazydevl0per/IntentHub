"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SyncRepositoryButton({
  repositoryId,
  demoMode,
}: {
  repositoryId: string;
  demoMode?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSync() {
    setLoading(true);
    const res = await fetch(`/api/repositories/${repositoryId}/sync`, {
      method: "POST",
    });
    setLoading(false);

    if (res.status === 202) {
      setTimeout(() => router.refresh(), 3000);
    } else {
      router.refresh();
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleSync}
      disabled={loading || demoMode}
      title={demoMode ? "Demo mode — read only" : undefined}
    >
      {loading ? "Syncing..." : "Sync"}
    </Button>
  );
}
