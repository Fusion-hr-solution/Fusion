"use client";

import { useTranslations } from "next-intl";
import { BarChart3 } from "lucide-react";
import { Card, CardContent } from "@repo/ui";
import { CATEGORY_CONFIG } from "@/data/categories";
import type { CategoryPerformanceProps } from "@/types/admin-props";

export function CategoryPerformance({ items }: CategoryPerformanceProps) {
  const t = useTranslations("adminDashboard");
  const tCommon = useTranslations("common");
  return (
    <Card className="overflow-hidden border border-border/60 bg-white">
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
            <BarChart3
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
          <h3 className="text-sm font-bold text-foreground">
            {t("categoryPerformance.heading")}
          </h3>
        </div>

        <div className="space-y-4">
          {items.map((item) => {
            const config = CATEGORY_CONFIG[item.category];
            if (!config) return null;
            return (
              <div key={item.category}>
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${config.badgeClass}`}
                  >
                    {tCommon(`category.${item.category}`)}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    <span className="font-bold text-foreground">
                      {item.rate}%
                    </span>{" "}
                    ({item.completed}/{item.total})
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${config.stripClass} transition-all duration-700 ease-out`}
                    style={{ width: `${item.rate}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
