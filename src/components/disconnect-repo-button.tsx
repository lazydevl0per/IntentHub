"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DisconnectRepositoryButton({
  repositoryId,
  isOwner,
}: {
  repositoryId: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDisconnect() {
    const message = isOwner
      ? "Disconnect this repository for all members? This cannot be undone."
      : "Leave this repository?";

    if (!window.confirm(message)) {
      return;
    }

    setLoading(true);

    const res = await fetch(`/api/repositories/${repositoryId}`, {
      method: "DELETE",
    });

    if (res.ok) {
      router.push("/");
      router.refresh();
    }

    setLoading(false);
  }

  return (
    <Button
      variant="outline"
      className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
      onClick={handleDisconnect}
      disabled={loading}
    >
      {loading ? "Disconnecting..." : isOwner ? "Disconnect Repository" : "Leave Repository"}
    </Button>
  );
}
