import Link from "next/link";
import { notFound } from "next/navigation";
import { KnowledgeGraphView } from "@/components/knowledge-graph-view";
import { Button } from "@/components/ui/button";
import { getObjectiveAccess } from "@/lib/data/objective";
import { getAppSession } from "@/lib/session";
import { ArrowLeft } from "lucide-react";

export default async function KnowledgeGraphPage({
  params,
}: {
  params: Promise<{ objectiveId: string }>;
}) {
  const session = await getAppSession();
  const userId = session!.user!.id;
  const { objectiveId } = await params;

  const objective = await getObjectiveAccess(objectiveId, userId);

  if (!objective) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="sm">
          <Link href={`/objectives/${objectiveId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Objective
          </Link>
        </Button>
        <div>
          <p className="text-sm text-zinc-500">Knowledge Graph</p>
          <h1 className="text-2xl font-semibold">{objective.title}</h1>
        </div>
      </div>
      <KnowledgeGraphView objectiveId={objectiveId} />
    </div>
  );
}
