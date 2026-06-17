import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  action,
}: EmptyStateProps) {
  return (
    <div className="ey-animate-scale-in flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card py-20">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
        <Icon className="h-6 w-6 text-muted-foreground/50" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      {action}
    </div>
  );
}
