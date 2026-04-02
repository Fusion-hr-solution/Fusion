import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  index?: number;
  delayBase?: number;
  delayStep?: number;
}

export function StatCard({
  icon: Icon,
  value,
  label,
  index = 0,
  delayBase = 200,
  delayStep = 60,
}: StatCardProps) {
  return (
    <div
      className="ey-animate-fade-up flex items-center gap-3 rounded-xl border border-border/60 bg-muted px-4 py-3 transition-all hover:shadow-sm"
      style={{ animationDelay: `${delayBase + index * delayStep}ms` }}
    >
      <Icon
        className="h-5 w-5 text-muted-foreground"
        aria-hidden="true"
      />
      <div>
        <p className="text-lg font-bold text-foreground leading-none">
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
