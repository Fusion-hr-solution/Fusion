import { CheckCircle2, Clock, Circle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CursusItemStatus } from "@/types";

export interface CursusStatusConfig {
  label: string;
  icon: LucideIcon;
  className: string;
}

export const CURSUS_STATUS_CONFIG: Record<CursusItemStatus, CursusStatusConfig> = {
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    className: "text-[var(--ey-green-500)]",
  },
  "in-progress": {
    label: "In Progress",
    icon: Clock,
    className: "text-[var(--ey-blue-500)]",
  },
  "not-started": {
    label: "Not Started",
    icon: Circle,
    className: "text-muted-foreground",
  },
};
