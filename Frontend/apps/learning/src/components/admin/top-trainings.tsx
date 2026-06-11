"use client";

import { useTranslations } from "next-intl";
import { TrendingUp, Users, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@repo/ui";
import type { TopTrainingsProps } from "@/types/admin-props";

export function TopTrainings({ items }: TopTrainingsProps) {
  const t = useTranslations("adminDashboard");
  return (
    <Card className="overflow-hidden border border-border/60 bg-white">
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--ey-yellow))]/15">
            <TrendingUp
              className="h-3.5 w-3.5 ey-text-accent"
              aria-hidden="true"
            />
          </div>
          <h3 className="text-sm font-bold text-foreground">
            {t("topTrainings.heading")}
          </h3>
        </div>

        <div className="space-y-3">
          {items.map((item, i) => (
            <div
              key={item.title}
              className="group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50"
            >
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md ey-bg-dark text-[10px] font-bold text-white mt-0.5">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground line-clamp-1 group-hover:text-[hsl(var(--ey-blue-600))] transition-colors">
                  {item.title}
                </p>
                <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" aria-hidden="true" />
                    {t("topTrainings.enrolled", { count: item.enrolled })}
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    {t("topTrainings.done", { rate: item.completionRate })}
                  </span>
                </div>
                <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[hsl(var(--ey-green-500))] transition-all duration-500"
                    style={{ width: `${item.completionRate}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
