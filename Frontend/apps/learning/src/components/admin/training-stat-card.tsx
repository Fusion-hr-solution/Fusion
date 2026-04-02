import { Card, CardContent } from "@repo/ui";
import type { LucideIcon } from "lucide-react";

interface TrainingStatCardProps {
  icon: LucideIcon;
  iconBgClass: string;
  iconColorClass: string;
  value: number;
  label: string;
}

export function TrainingStatCard({
  icon: Icon,
  iconBgClass,
  iconColorClass,
  value,
  label,
}: TrainingStatCardProps) {
  return (
    <Card className="border-border/60">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBgClass}`}>
          <Icon className={`h-4 w-4 ${iconColorClass}`} />
        </div>
        <div>
          <p className="text-lg font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
