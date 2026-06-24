import { Users } from "lucide-react";
import { OverviewCard } from "./overview-card";
import {
  initialsOf,
  type TeamProgressRow,
  type TeamProgressStatus,
} from "@/data/admin-overview";

const STATUS_STYLES: Record<TeamProgressStatus, { bar: string; text: string }> = {
  "on-track": {
    bar: "bg-[hsl(var(--ey-blue-400))]",
    text: "text-[hsl(var(--ey-blue-600))]",
  },
  completed: {
    bar: "bg-[hsl(var(--ey-green-500))]",
    text: "text-[hsl(var(--ey-green-500))]",
  },
  "at-risk": {
    bar: "bg-[hsl(var(--ey-orange-500))]",
    text: "text-[hsl(var(--ey-orange-500))]",
  },
};

const GRID = "grid grid-cols-[2.4fr_1.4fr_0.8fr_1.6fr] items-center gap-3";

interface TeamProgressCardProps {
  rows: TeamProgressRow[];
  totalLearners: number;
}

export function TeamProgressCard({ rows, totalLearners }: TeamProgressCardProps) {
  return (
    <OverviewCard
      icon={Users}
      title="Team Progress"
      action={
        <span className="text-xs text-muted-foreground">
          {rows.length} of {totalLearners.toLocaleString("en-US")} learners
        </span>
      }
    >
      {/* Column headers */}
      <div
        className={`${GRID} border-b border-border/60 px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground`}
      >
        <span>Employee</span>
        <span>Department</span>
        <span className="text-center">Done</span>
        <span>Completion</span>
      </div>

      <div className="ey-stagger-list">
        {rows.map((row) => {
          const style = STATUS_STYLES[row.status];
          return (
            <div
              key={row.id}
              className={`${GRID} border-b border-border/60 px-5 py-3 last:border-b-0`}
            >
              {/* Employee */}
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ey-bg-dark text-[11px] font-bold text-white ring-1 ring-border">
                  {initialsOf(row.name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-foreground">
                    {row.name}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {row.role}
                  </p>
                </div>
              </div>

              {/* Department */}
              <span className="truncate text-xs text-muted-foreground">
                {row.department}
              </span>

              {/* Done */}
              <span className="text-center text-xs font-bold tabular-nums text-foreground">
                {row.done}/{row.assigned}
              </span>

              {/* Completion */}
              <div className="flex items-center gap-2.5">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${style.bar} ey-animate-stripe`}
                    style={{ width: `${row.completion}%` }}
                  />
                </div>
                <span
                  className={`min-w-[34px] text-right text-xs font-bold tabular-nums ${style.text}`}
                >
                  {row.completion}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </OverviewCard>
  );
}
