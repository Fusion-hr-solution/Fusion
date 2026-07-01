import { Calendar, PlayCircle, CheckCircle2, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SessionStatus } from "@/types/admin";

export interface SessionStatusEntry {
  /** Stable key into common.sessionStatus.* — translated at render. */
  labelKey: SessionStatus;
  icon: LucideIcon;
  /** Tailwind classes for the badge background + text. */
  className: string;
  /** Shadcn Badge variant fallback. */
  variant: "default" | "secondary" | "destructive" | "outline";
}

export const SESSION_STATUS_CONFIG: Record<SessionStatus, SessionStatusEntry> =
  {
    Planned: {
      labelKey: "Planned",
      icon: Calendar,
      className:
        "bg-[hsl(var(--learning-blue-500))]/10 text-[hsl(var(--learning-blue-500))]",
      variant: "secondary",
    },
    InProgress: {
      labelKey: "InProgress",
      icon: PlayCircle,
      className:
        "bg-[hsl(var(--ey-yellow))]/10 text-[hsl(var(--ey-orange-500))]",
      variant: "default",
    },
    Completed: {
      labelKey: "Completed",
      icon: CheckCircle2,
      className:
        "bg-[hsl(var(--ey-green-500))]/10 text-[hsl(var(--ey-green-500))]",
      variant: "outline",
    },
    Cancelled: {
      labelKey: "Cancelled",
      icon: XCircle,
      className: "bg-destructive/10 text-destructive",
      variant: "destructive",
    },
  };

export const SESSION_STATUS_OPTIONS: {
  value: SessionStatus;
  labelKey: SessionStatus;
}[] = [
  { value: "Planned", labelKey: "Planned" },
  { value: "InProgress", labelKey: "InProgress" },
  { value: "Completed", labelKey: "Completed" },
  { value: "Cancelled", labelKey: "Cancelled" },
];
