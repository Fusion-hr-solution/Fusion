"use client";

import { useMemo, useCallback } from "react";
import { Route, BookOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@repo/ui";
import { useApiQuery } from "@repo/api/react";
import { getMyCursus } from "@/services/learning-service";
import type { MyCursus } from "@/types";
import { CursusItemCard } from "./cursus-item-card";
import { CursusSummaryCards } from "./cursus-summary-cards";

export function MyCursusView() {
  const t = useTranslations("cursus");
  const fetchFn = useCallback(() => getMyCursus(), []);
  const { data: cursus, isLoading } = useApiQuery<MyCursus | null>(fetchFn, {
    enabled: true,
  });

  const grouped = useMemo(() => {
    if (!cursus?.items) return { required: [], optional: [] };
    const sorted = cursus.items
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex);
    return {
      required: sorted.filter((i) => i.isRequired),
      optional: sorted.filter((i) => !i.isRequired),
    };
  }, [cursus]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        {t("loading")}
      </div>
    );
  }

  if (!cursus) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Route className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-1">
          {t("emptyTitle")}
        </h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          {t("emptyDescription")}
        </p>
      </div>
    );
  }

  const completionPct =
    cursus.summary.totalCount > 0
      ? Math.round(
          (cursus.summary.completedCount / cursus.summary.totalCount) * 100
        )
      : 0;

  return (
    <div className="space-y-6 ey-animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <CursusSummaryCards
        summary={cursus.summary}
        completionPct={completionPct}
      />

      {grouped.required.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> {t("requiredFormations")}{" "}
            <Badge variant="secondary" className="text-xs">
              {grouped.required.length}
            </Badge>
          </h2>
          <div className="space-y-3 ey-stagger-list">
            {grouped.required.map((item) => (
              <CursusItemCard key={item.mappingId} item={item} />
            ))}
          </div>
        </div>
      )}

      {grouped.optional.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> {t("optionalFormations")}{" "}
            <Badge variant="outline" className="text-xs">
              {grouped.optional.length}
            </Badge>
          </h2>
          <div className="space-y-3 ey-stagger-list">
            {grouped.optional.map((item) => (
              <CursusItemCard key={item.mappingId} item={item} />
            ))}
          </div>
        </div>
      )}

      {cursus.summary.estimatedRemainingMinutes > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {t("estimatedRemaining", {
            hours: Math.floor(cursus.summary.estimatedRemainingMinutes / 60),
            minutes: cursus.summary.estimatedRemainingMinutes % 60,
          })}
        </p>
      )}
    </div>
  );
}
