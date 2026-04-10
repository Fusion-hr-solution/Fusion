"use client";

import { FileText, Mail, CheckCircle2, Pause, Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: typeof FileText; className: string }
> = {
  draft: {
    label: "Draft",
    icon: FileText,
    className: "bg-muted text-muted-foreground",
  },
  invited: {
    label: "Invited",
    icon: Mail,
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  active: {
    label: "Active",
    icon: CheckCircle2,
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  suspended: {
    label: "Suspended",
    icon: Pause,
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
  archived: {
    label: "Archived",
    icon: Archive,
    className: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft!;
  const Icon = config!.icon;

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

export function InviteStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    pending: {
      label: "Pending",
      className:
        "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    },
    accepted: {
      label: "Accepted",
      className:
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    },
    expired: {
      label: "Expired",
      className:
        "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    },
    revoked: {
      label: "Revoked",
      className:
        "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
    },
    none: {
      label: "None",
      className: "bg-muted text-muted-foreground",
    },
  };

  const c = config[status] ?? config.none!;

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 border-transparent font-medium", c!.className)}
    >
      {c!.label}
    </Badge>
  );
}
