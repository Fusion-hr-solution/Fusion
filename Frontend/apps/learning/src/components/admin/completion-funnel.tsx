import { Shield } from "lucide-react";
import {
  Card,
  CardContent,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@repo/ui";
import type { CompletionFunnelProps } from "@/types/admin-props";

export function CompletionFunnel({
  completed,
  inProgress,
  notStarted,
  total,
}: CompletionFunnelProps) {
  const segments = [
    {
      label: "Completed",
      value: completed,
      pct: total > 0 ? Math.round((completed / total) * 100) : 0,
      color: "bg-[hsl(var(--ey-green-500))]",
      dotColor: "bg-[hsl(var(--ey-green-500))]",
    },
    {
      label: "In Progress",
      value: inProgress,
      pct: total > 0 ? Math.round((inProgress / total) * 100) : 0,
      color: "bg-[hsl(var(--ey-blue-400))]",
      dotColor: "bg-[hsl(var(--ey-blue-400))]",
    },
    {
      label: "Not Started",
      value: notStarted,
      pct: total > 0 ? Math.round((notStarted / total) * 100) : 0,
      color: "bg-[hsl(var(--ey-grey-300))]",
      dotColor: "bg-[hsl(var(--ey-grey-300))]",
    },
  ];

  return (
    <Card className="overflow-hidden border border-border/60 bg-white">
      <div className="h-1 w-full ey-bg-dark-deep ey-animate-stripe" />
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--ey-black))]/8">
            <Shield
              className="h-3.5 w-3.5 text-[hsl(var(--ey-grey-500))]"
              aria-hidden="true"
            />
          </div>
          <h3 className="text-sm font-bold text-foreground">
            Completion Funnel
          </h3>
        </div>

        {/* Stacked bar */}
        <div className="h-4 flex rounded-full overflow-hidden bg-[hsl(var(--ey-grey-200))] mb-5">
          {segments.map(
            (seg) =>
              seg.pct > 0 && (
                <Tooltip key={seg.label}>
                  <TooltipTrigger asChild>
                    <div
                      className={`${seg.color} transition-all duration-700 ease-out`}
                      style={{ width: `${seg.pct}%` }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {seg.label}: {seg.value} ({seg.pct}%)
                  </TooltipContent>
                </Tooltip>
              )
          )}
        </div>

        {/* Legend */}
        <div className="space-y-2.5">
          {segments.map((seg) => (
            <div
              key={seg.label}
              className="flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${seg.dotColor}`}
                />
                <span className="text-muted-foreground">{seg.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground tabular-nums">
                  {seg.value}
                </span>
                <span className="text-muted-foreground tabular-nums w-8 text-right">
                  {seg.pct}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
