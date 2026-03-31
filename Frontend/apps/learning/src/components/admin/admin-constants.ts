import { CheckCircle2, CircleDashed, Play } from "lucide-react";
import type { TrainingStatus } from "@/types";

export function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("");
}

export function statusLabel(s: TrainingStatus): string {
  return s === "in-progress"
    ? "In Progress"
    : s === "completed"
      ? "Completed"
      : "Not Started";
}

export const STATUS_COLORS: Record<TrainingStatus, string> = {
  "in-progress":
    "bg-[hsl(var(--ey-blue-400))]/10 text-[hsl(var(--ey-blue-600))] border-[hsl(var(--ey-blue-400))]/25",
  completed:
    "bg-[hsl(var(--ey-green-500))]/10 text-[hsl(var(--ey-green-500))] border-[hsl(var(--ey-green-500))]/25",
  "not-started":
    "bg-[hsl(var(--ey-grey-200))] text-[hsl(var(--ey-grey-400))] border-[hsl(var(--ey-grey-300))]/25",
};

export const STATUS_ICONS: Record<TrainingStatus, typeof Play> = {
  "in-progress": Play,
  completed: CheckCircle2,
  "not-started": CircleDashed,
};

export const AVATAR_COLOR = "bg-[hsl(var(--ey-grey-500))]";
