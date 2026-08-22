"use client";

import { CalendarRange, ChevronDown } from "lucide-react";
import type { CycleSummaryDto } from "@repo/api";
import { StatusBadge, type StatusTone } from "@repo/ds/shell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ds/components/ui/dropdown-menu";
import { cn } from "@repo/ds/lib/utils";
import { formatDate, formatDateRange } from "../lib";

const STATE_TONE: Record<CycleSummaryDto["state"], StatusTone> = {
  Draft: "info",
  Active: "success",
  Closed: "muted",
};

const STATE_LABEL: Record<CycleSummaryDto["state"], string> = {
  Draft: "Draft — in setup",
  Active: "Active",
  Closed: "Closed",
};

export function CycleWorkspaceHeader({
  cycle,
  cycles,
  onSelectCycle,
  actions,
}: {
  cycle: CycleSummaryDto;
  cycles?: CycleSummaryDto[];
  onSelectCycle?: (cycleId: string) => void;
  actions?: React.ReactNode;
}) {
  const others = (cycles ?? []).filter((candidate) => candidate.id !== cycle.id);

  return (
    <div className="flex flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Performance Cycle
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          {others.length > 0 && onSelectCycle ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="group inline-flex items-center gap-1.5 rounded-md text-2xl font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="truncate">{cycle.name}</span>
                <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-56">
                {[cycle, ...others].map((candidate) => (
                  <DropdownMenuItem
                    key={candidate.id}
                    onSelect={() => onSelectCycle(candidate.id)}
                    className={cn("flex items-center justify-between gap-3", candidate.id === cycle.id && "font-medium")}
                  >
                    <span className="truncate">{candidate.name}</span>
                    <StatusBadge tone={STATE_TONE[candidate.state]}>{candidate.state}</StatusBadge>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <h1 className="truncate text-2xl font-semibold tracking-tight">{cycle.name}</h1>
          )}
          <StatusBadge tone={STATE_TONE[cycle.state]} dot>
            {STATE_LABEL[cycle.state]}
          </StatusBadge>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarRange className="size-3.5" aria-hidden />
          <span>{formatDateRange(cycle.startDate, cycle.endDate)}</span>
          <span className="text-muted-foreground/50">·</span>
          <span>Planning by {formatDate(cycle.planningDeadline)}</span>
        </p>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
