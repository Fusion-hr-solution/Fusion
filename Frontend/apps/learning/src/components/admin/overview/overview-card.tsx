import type { LucideIcon } from "lucide-react";
import { Card } from "@repo/ui";

interface OverviewCardProps {
  icon: LucideIcon;
  title: string;
  /** Icon container classes (e.g. `ey-bg-dark` or a tinted accent). */
  iconClassName?: string;
  /** Icon color class. */
  iconColorClassName?: string;
  /** Optional element rendered at the right of the header (link, count, …). */
  action?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Card shell for the admin Overview list panels: a bordered header row
 * (icon chip + title + optional action) above the body. Mirrors the spacing
 * of the dashboard's section cards so the two roles feel like one product.
 */
export function OverviewCard({
  icon: Icon,
  title,
  iconClassName = "ey-bg-dark",
  iconColorClassName = "text-white",
  action,
  children,
}: OverviewCardProps) {
  return (
    <Card className="overflow-hidden border border-border/60 bg-card">
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconClassName}`}
          >
            <Icon
              className={`h-3.5 w-3.5 ${iconColorClassName}`}
              aria-hidden="true"
            />
          </div>
          <h2 className="text-sm font-bold text-foreground">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}
