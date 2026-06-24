import { Calendar, PlayCircle, CheckCircle2, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SessionStatus } from "@/types/admin";

export interface SessionStatusEntry {
  label: string;
  icon: LucideIcon;
  /** Tailwind classes for the badge background + text. */
  className: string;
  /** Shadcn Badge variant fallback. */
  variant: "default" | "secondary" | "destructive" | "outline";
}

export const SESSION_STATUS_CONFIG: Record<SessionStatus, SessionStatusEntry> = {
  Planned: {
    label: "Planned",
    icon: Calendar,
    className: "bg-[hsl(var(--ey-blue-500))]/10 text-[hsl(var(--ey-blue-500))]",
    variant: "secondary",
  },
  InProgress: {
    label: "In Progress",
    icon: PlayCircle,
    className: "bg-[hsl(var(--ey-orange-500))]/10 text-[hsl(var(--ey-orange-500))]",
    variant: "default",
  },
  Completed: {
    label: "Completed",
    icon: CheckCircle2,
    className: "bg-[hsl(var(--ey-green-500))]/10 text-[hsl(var(--ey-green-500))]",
    variant: "outline",
  },
  Cancelled: {
    label: "Cancelled",
    icon: XCircle,
    className: "bg-destructive/10 text-destructive",
    variant: "destructive",
  },
};

export const SESSION_STATUS_OPTIONS: { value: SessionStatus; label: string }[] = [
  { value: "Planned", label: "Planned" },
  { value: "InProgress", label: "In Progress" },
  { value: "Completed", label: "Completed" },
  { value: "Cancelled", label: "Cancelled" },
];
