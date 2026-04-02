import { Play, CheckCircle2, CircleDashed } from "lucide-react";
import type { TrainingStatus, StatusConfigEntry } from "@/types";

export const STATUS_CONFIG: Record<TrainingStatus, StatusConfigEntry> = {
  "in-progress": {
    icon: Play,
    label: "In Progress",
    className: "bg-[hsl(var(--ey-blue-400))]/10 text-[hsl(var(--ey-blue-600))]",
    buttonLabel: "Continue",
    buttonClass: "ey-bg-dark hover:bg-[hsl(var(--ey-black))] text-white",
  },
  completed: {
    icon: CheckCircle2,
    label: "Completed",
    className:
      "bg-[hsl(var(--ey-green-500))]/10 text-[hsl(var(--ey-green-500))]",
    buttonLabel: "Review",
    buttonClass:
      "border border-border bg-white text-foreground hover:bg-muted",
  },
  "not-started": {
    icon: CircleDashed,
    label: "Not Started",
    className: "bg-muted text-muted-foreground",
    buttonLabel: "Start",
    buttonClass: "ey-bg-accent text-muted-foreground hover:opacity-90",
  },
};
