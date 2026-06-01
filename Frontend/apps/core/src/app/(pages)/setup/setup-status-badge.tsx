"use client";

import {
  CheckCircle2,
  CircleDashed,
  Flag,
  Rocket,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CoreSetupPhase, TenantSetupStateDto } from "@repo/api";

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
    label: "Draft active",
    icon: Flag,
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  structurallyGoverned: {
    label: "Draft ready",
    icon: Flag,
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  structurallyPublished: {
    label: "Live structure",
    icon: CheckCircle2,
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  operational: {
    label: "Live structure",
    icon: Rocket,
    className:
      "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
  },
};

function getStatusConfig(setupState: Pick<
  TenantSetupStateDto,
  "currentPhase" | "hasPublishedStructure" | "requiresRepublish"
>) {
  if (setupState.requiresRepublish) {
    return {
      label: "Draft changes pending",
      icon: Flag,
      className:
        "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    };
  }

  if (
    setupState.hasPublishedStructure &&
    (setupState.currentPhase === "activated" ||
      setupState.currentPhase === "structurallyGoverned")
  ) {
    return STATUS_CONFIG.operational;
  }

  return STATUS_CONFIG[setupState.currentPhase];
}

export function SetupStatusBadge({
  setupState,
}: {
  setupState: Pick<
    TenantSetupStateDto,
    "currentPhase" | "hasPublishedStructure" | "requiresRepublish"
  >;
}) {
  const config = getStatusConfig(setupState);
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
