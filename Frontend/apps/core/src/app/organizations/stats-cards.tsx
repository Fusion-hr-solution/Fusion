"use client";

import {
  Building2,
  AlertTriangle,
  Mail,
  CheckCircle2,
} from "lucide-react";
import type { PlatformOrganizationStatsDto } from "@repo/api";
import { Skeleton } from "@/components/ui/skeleton";

interface StatsCardsProps {
  stats: PlatformOrganizationStatsDto | undefined;
  isLoading: boolean;
}

const CARDS = [
  {
    key: "totalOrganizations" as const,
    label: "Total Organizations",
    icon: Building2,
    format: formatCount,
  },
  {
    key: "attentionNeeded" as const,
    label: "Attention Needed",
    icon: AlertTriangle,
    format: formatCount,
    highlight: true,
  },
  {
    key: "invitedPending" as const,
    label: "Invites Pending",
    icon: Mail,
    format: formatCount,
  },
  {
    key: "activeOrganizations" as const,
    label: "Active Orgs",
    icon: CheckCircle2,
    format: formatCount,
  },
];

function formatCount(n: number): string {
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1_000) return n.toLocaleString();
  return String(n);
}

export function StatsCards({ stats, isLoading }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {CARDS.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.key}
            className="flex flex-col gap-1 rounded-xl border bg-card p-4 ring-1 ring-foreground/5"
          >
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <Icon className="size-3.5" />
              {card.label}
            </div>
            {isLoading || !stats ? (
              <Skeleton className="mt-1 h-8 w-16" />
            ) : (
              <div
                className={`text-2xl font-bold tabular-nums ${
                  card.highlight && stats[card.key] > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-foreground"
                }`}
              >
                {card.format(stats[card.key])}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
