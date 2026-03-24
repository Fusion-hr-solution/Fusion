import type { Training } from "@/types";
import { getTrainingDetailStats } from "@/data/training-detail-stats";

export function TrainingStatsGrid({ training }: { training: Training }) {
  const stats = getTrainingDetailStats(training);

  return (
    <div
      className="ey-animate-fade-up grid grid-cols-2 gap-3 sm:grid-cols-5"
      style={{ animationDelay: "200ms" }}
    >
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="flex flex-col items-center gap-2 rounded-xl border border-border/50 bg-white p-4 text-center transition-all hover:shadow-md hover:shadow-black/5 hover:-translate-y-0.5"
          >
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.bgClass}`}
            >
              <Icon
                className={`h-4 w-4 ${stat.iconClass}`}
                aria-hidden="true"
              />
            </div>
            <span className="text-lg font-bold text-foreground tabular-nums">
              {stat.value}
            </span>
            <span className="text-xs text-muted-foreground">
              {stat.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
