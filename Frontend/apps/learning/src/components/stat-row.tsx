import type { StatRowProps } from "@/types/component-props";

export function StatRow({ label, value }: StatRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-bold text-foreground tabular-nums">{value}</span>
    </div>
  );
}
