import { BarChart3 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@repo/ui";
import type { ProgressRingProps } from "@/types/component-props";

export function ProgressRing({
  completionRate,
  avgProgress,
  total,
  completed,
  inProgress,
}: ProgressRingProps) {
  const t = useTranslations("dashboard.progressOverview");
  const circumference = 2 * Math.PI * 54;
  const completedStroke = (completed / Math.max(total, 1)) * circumference;
  const inProgressStroke = (inProgress / Math.max(total, 1)) * circumference;

  return (
    <Card className="overflow-hidden border border-border/60 bg-card">
      <div className="h-1 w-full bg-muted ey-animate-stripe" />
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
            <BarChart3
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
          <h3 className="text-sm font-bold text-foreground">{t("title")}</h3>
        </div>

        {/* Ring chart */}
        <div className="flex justify-center mb-5">
          <div className="relative">
            <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="hsl(var(--ey-grey-200))"
                strokeWidth="8"
              />
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="hsl(var(--ey-green-500))"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${completedStroke} ${circumference}`}
                className="transition-all duration-1000 ease-out"
              />
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="hsl(var(--ey-blue-400))"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${inProgressStroke} ${circumference}`}
                strokeDashoffset={`-${completedStroke}`}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-foreground tabular-nums leading-none">
                {completionRate}%
              </span>
              <span className="text-[10px] text-muted-foreground mt-1">
                {t("complete")}
              </span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--ey-green-500))]" />
              <span className="text-muted-foreground">{t("completed")}</span>
            </div>
            <span className="font-bold text-foreground tabular-nums">
              {completed}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--ey-blue-400))]" />
              <span className="text-muted-foreground">{t("inProgress")}</span>
            </div>
            <span className="font-bold text-foreground tabular-nums">
              {inProgress}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-muted" />
              <span className="text-muted-foreground">{t("notStarted")}</span>
            </div>
            <span className="font-bold text-foreground tabular-nums">
              {total - completed - inProgress}
            </span>
          </div>
        </div>

        {/* Avg progress bar */}
        {inProgress > 0 && (
          <div className="mt-4 pt-4 border-t border-border/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">
                {t("avgProgress")}
              </span>
              <span className="text-xs font-bold text-foreground tabular-nums">
                {avgProgress}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-[hsl(var(--ey-blue-400))] transition-all duration-700 ease-out"
                style={{ width: `${avgProgress}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
