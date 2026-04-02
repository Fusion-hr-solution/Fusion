import { Card, CardContent } from "@repo/ui";
import type { MetaCardProps } from "@/types/admin-props";

export function MetaCard({ label, value }: MetaCardProps) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
