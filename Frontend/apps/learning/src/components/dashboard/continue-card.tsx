import Link from "next/link";
import { Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@repo/ui";
import type { ContinueCardProps } from "@/types/component-props";
import { CATEGORY_CONFIG } from "@/data/categories";
import { STATUS_CONFIG } from "@/data/status-config";

export function ContinueCard({ training }: ContinueCardProps) {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");
  const category = CATEGORY_CONFIG[training.category];
  const status = STATUS_CONFIG[training.status];
  const StatusIcon = status.icon;

  return (
    <Link
      href={`/training/${training.id}/learn`}
      aria-label={t("continueAria", { title: training.title })}
      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="group overflow-hidden border border-border/60 bg-card transition-all duration-300 hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 cursor-pointer">
        <div
          className={`h-1 w-full ey-animate-stripe ${category.stripClass}`}
        />
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            {/* Progress ring */}
            <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center">
              <svg className="h-14 w-14 -rotate-90" viewBox="0 0 48 48">
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="hsl(var(--ey-grey-200))"
                  strokeWidth="3"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="hsl(var(--ey-blue-400))"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${(training.progress / 100) * 125.6} 125.6`}
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <span className="absolute text-xs font-bold text-foreground tabular-nums">
                {training.progress}%
              </span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${category.badgeClass}`}
                >
                  {tCommon(`category.${training.category}`)}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.className}`}
                >
                  <StatusIcon className="h-2.5 w-2.5" aria-hidden="true" />
                  {tCommon(`status.${training.status}`)}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-foreground line-clamp-1 group-hover:text-[hsl(var(--ey-blue-600))] transition-colors">
                {training.title}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("chapterOf", {
                  current: training.currentChapter,
                  total: training.chaptersCount,
                })}{" "}
                · {training.duration}
              </p>
            </div>

            {/* Action */}
            <span
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ey-bg-dark text-white shadow-sm transition-all duration-300 group-hover:bg-[hsl(var(--ey-black))] group-hover:shadow-md group-hover:scale-105"
              aria-hidden="true"
            >
              <Play className="h-3.5 w-3.5 ml-0.5" aria-hidden="true" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
