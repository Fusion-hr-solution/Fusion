import { GraduationCap } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@repo/ui";
import type { CategoryBreakdownProps } from "@/types/component-props";
import { CATEGORY_CONFIG } from "@/data/categories";

export function CategoryBreakdown({ items }: CategoryBreakdownProps) {
  const t = useTranslations("dashboard.categoryBreakdown");
  const tCommon = useTranslations("common");
  return (
    <Card className="overflow-hidden border border-border/60 bg-card">
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
            <GraduationCap
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
          <h3 className="text-sm font-bold text-foreground">{t("title")}</h3>
        </div>

        <div className="space-y-3.5">
          {items.map((item) => {
            const config = CATEGORY_CONFIG[item.category];
            return (
              <div key={item.category}>
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${config.badgeClass}`}
                  >
                    {tCommon(`category.${item.category}`)}
                  </span>
                  <span className="text-xs font-bold text-foreground tabular-nums">
                    {item.count}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${config.stripClass} transition-all duration-700 ease-out`}
                    style={{ width: `${item.percentage}%` }}
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
