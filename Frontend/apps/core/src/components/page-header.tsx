import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  size?: "default" | "compact";
}

export function PageHeader({
  title,
  description,
  actions,
  className,
  size = "default",
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between sm:flex-row sm:items-start",
        size === "compact" ? "gap-2" : "gap-4",
        className
      )}
    >
      <div className={cn("min-w-0", size === "compact" ? "space-y-0.5" : "space-y-1")}>
        <h1
          className={cn(
            "font-semibold tracking-tight",
            size === "compact" ? "text-xl" : "text-2xl"
          )}
        >
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="shrink-0 sm:self-start">{actions}</div>}
    </div>
  );
}
