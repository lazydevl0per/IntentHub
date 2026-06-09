import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ObjectiveSummary({
  objective,
}: {
  objective: {
    businessSummary: string | null;
    technicalSummary: string | null;
    risks: string | null;
    architectureImpact: string | null;
  };
}) {
  if (
    !objective.businessSummary &&
    !objective.technicalSummary &&
    !objective.risks &&
    !objective.architectureImpact
  ) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Objective Summary</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {objective.businessSummary && (
          <div>
            <p className="text-sm font-medium text-zinc-500">Business</p>
            <p className="text-sm">{objective.businessSummary}</p>
          </div>
        )}
        {objective.technicalSummary && (
          <div>
            <p className="text-sm font-medium text-zinc-500">Technical</p>
            <p className="text-sm">{objective.technicalSummary}</p>
          </div>
        )}
        {objective.architectureImpact && (
          <div>
            <p className="text-sm font-medium text-zinc-500">Architecture Impact</p>
            <p className="text-sm">{objective.architectureImpact}</p>
          </div>
        )}
        {objective.risks && (
          <div>
            <p className="text-sm font-medium text-zinc-500">Risks</p>
            <p className="text-sm">{objective.risks}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
