import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  index?: number;
  delayBase?: number;
  delayStep?: number;
}

export function KpiCard({
  icon: Icon,
  value,
  label,
  index = 0,
  delayBase = 240,
  delayStep = 60,
}: KpiCardProps) {
  return (
    <div
      className="ey-animate-fade-up group flex items-center gap-3.5 rounded-xl border border-border/60 bg-white px-4 py-4 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
      style={{ animationDelay: `${delayBase + index * delayStep}ms` }}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted transition-transform duration-300 group-hover:scale-105">
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <div>
        <p className="text-lg font-bold text-foreground leading-none tabular-nums">
          {value}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
