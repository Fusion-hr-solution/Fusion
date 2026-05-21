"use client";

import {
  CheckCircle2,
  CircleDashed,
  Flag,
  Rocket,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CoreSetupPhase } from "@repo/api";

const STATUS_CONFIG: Record<
  CoreSetupPhase,
  { label: string; icon: typeof CircleDashed; className: string }
> = {
  notStarted: {
    label: "Not started",
    icon: CircleDashed,
    className: "bg-muted text-muted-foreground",
  },
  activated: {
    label: "Draft structure",
    icon: Flag,
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  structurallyGoverned: {
    label: "Structure approved",
    icon: ShieldCheck,
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  structurallyPublished: {
    label: "Published structure",
    icon: CheckCircle2,
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  operational: {
    label: "Setup complete",
    icon: Rocket,
    className:
      "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
  },
};

export function SetupStatusBadge({ status }: { status: CoreSetupPhase }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 border-transparent font-medium", config.className)}
    >
      <Icon className="size-3" />
      {config.label}
    </Badge>
  );
}
