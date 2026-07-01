import { BarChart3 } from "lucide-react";
import { Card, CardContent } from "@repo/ui";
import { CATEGORY_CONFIG } from "@/data/categories";
import type { CategoryRate } from "@/data/admin-overview";

interface CategoryCompletionCardProps {
  rates: CategoryRate[];
}

/**
 * Completion rate per training category. Uses the same neutral category strips
 * as the employee dashboard's `CategoryBreakdown` (the app deliberately keeps
 * category colors neutral — see `globals.css`) so both views stay consistent.
 */
export function CategoryCompletionCard({ rates }: CategoryCompletionCardProps) {
  return (
    <Card className="overflow-hidden border border-border/60 bg-card">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
            <BarChart3
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
          <h3 className="text-sm font-bold text-foreground">
            Completion by Category
          </h3>
        </div>

        <div className="space-y-3.5">
          {rates.map((item) => {
            const config = CATEGORY_CONFIG[item.category];
            return (
              <div key={item.category}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {config.label}
                  </span>
                  <span className="text-xs font-bold tabular-nums text-foreground">
                    {item.rate}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${config.stripClass} ey-animate-stripe`}
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
