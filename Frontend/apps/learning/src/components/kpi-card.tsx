import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  /** Retained for call-site compatibility; the entrance stagger was removed. */
  index?: number;
  delayBase?: number;
  delayStep?: number;
}

export function KpiCard({ icon: Icon, value, label }: KpiCardProps) {
  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-border/60 bg-card px-4 py-4 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <div>
        <p className="text-lg font-bold text-foreground leading-none tabular-nums">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
