import { Badge } from "@repo/ui";
import { type Interview } from "@/types";

const variantMap: Record<Interview["status"], "default" | "secondary" | "outline"> = {
  scheduled: "outline",
  "in-progress": "default",
  completed: "secondary",
  cancelled: "outline",
};

const labelMap: Record<Interview["status"], string> = {
  scheduled: "Scheduled",
  "in-progress": "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function InterviewStatusBadge({ status }: { status: Interview["status"] }) {
  return <Badge variant={variantMap[status]}>{labelMap[status]}</Badge>;
}
