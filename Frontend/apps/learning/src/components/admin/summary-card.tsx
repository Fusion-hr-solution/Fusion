import { Card, CardContent } from "@repo/ui";
import type { SummaryCardProps } from "@/types/admin-props";

export function SummaryCard({ label, value, icon }: SummaryCardProps) {
  return (
    <Card className="border-border/60">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          {icon}
        </div>
        <div>
          <p className="text-lg font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
