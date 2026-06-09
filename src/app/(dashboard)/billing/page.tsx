import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function BillingPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1 text-zinc-500">
          Team billing is not enabled yet. IntentHub is free during the design
          partner phase.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Design partner plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
          <p>Unlimited repositories and objectives for early teams.</p>
          <p>Agent runs, repository chat, and knowledge graph included.</p>
          <p>Contact the IntentHub team when you are ready to move to paid seats.</p>
        </CardContent>
      </Card>
    </div>
  );
}
