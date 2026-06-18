import { Badge } from "@repo/ui";
import type { CycleDeadlineState, PerformanceCycleStatus } from "@repo/api";

const STATUS_VARIANT: Record<PerformanceCycleStatus, "default" | "secondary" | "outline"> = {
  Draft: "outline",
  Published: "secondary",
  Active: "default",
  Closed: "outline",
};

export function CycleStatusBadge({ status }: { status: PerformanceCycleStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>;
}

const DEADLINE_LABEL: Record<Exclude<CycleDeadlineState, "None" | "Upcoming">, string> = {
  DueSoon: "Due soon",
  Overdue: "Overdue",
};

export function DeadlineBadge({ state }: { state: CycleDeadlineState }) {
  if (state === "None" || state === "Upcoming") return null;
  return (
    <Badge variant={state === "Overdue" ? "default" : "secondary"}>
      {DEADLINE_LABEL[state]}
    </Badge>
  );
}
