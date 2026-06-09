"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SyncRepositoryButton({
  repositoryId,
}: {
  repositoryId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSync() {
    setLoading(true);
    await fetch(`/api/repositories/${repositoryId}/sync`, {
      method: "POST",
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <Button variant="outline" onClick={handleSync} disabled={loading}>
      {loading ? "Syncing..." : "Sync"}
    </Button>
  );
}
