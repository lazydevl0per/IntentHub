import { Badge } from "@/components/ui/badge";

const statusVariants: Record<string, "default" | "secondary" | "success" | "warning" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  ACTIVE: "default",
  COMPLETED: "success",
  ARCHIVED: "outline",
  PENDING: "warning",
  RUNNING: "default",
  FAILED: "destructive",
  REJECTED: "destructive",
  SELECTED: "success",
  LOW: "outline",
  MEDIUM: "secondary",
  HIGH: "warning",
  CRITICAL: "destructive",
  GENERATING_PLANS: "default",
  AWAITING_PLAN_APPROVAL: "warning",
  EVALUATING: "default",
  AWAITING_DECISION_APPROVAL: "warning",
  CANCELLED: "outline",
};

export function StatusBadge({ value }: { value: string }) {
  return (
    <Badge variant={statusVariants[value] ?? "outline"}>
      {value}
    </Badge>
  );
}
