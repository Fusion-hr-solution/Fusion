"use client";

import { type LucideIcon, FileX2 } from "lucide-react";
import { Button } from "../primitives/button";
import { cn } from "../../lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  layout?: "centered" | "inline";
  size?: "default" | "compact";
  className?: string;
}

/**
 * Reusable empty state component for lists and tables.
 * Shows when a data source returns no results.
 * 
 * @example
 * ```tsx
 * <EmptyState
 *   icon={Users}
 *   title="No employees found"
 *   description="Add employees to get started"
 *   action={{ label: "Add Employee", onClick: () => {} }}
 * />
 * ```
 */
export function EmptyState({
  icon: Icon = FileX2,
  title,
  description,
  action,
  layout = "centered",
  size = "default",
  className,
}: EmptyStateProps) {
  const isInline = layout === "inline";
  const isCompact = size === "compact";

  return (
    <div
      className={cn(
        "flex flex-col",
        isInline
          ? "items-start justify-start gap-3 rounded-lg border border-dashed bg-muted/20 p-4 text-left"
          : "items-center justify-center px-4 py-12 text-center",
        className
      )}
    >
      <div
        className={cn(
          "rounded-full",
          isInline ? "bg-background" : "bg-muted",
          isCompact ? "p-2" : "p-3"
        )}
      >
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className={cn("space-y-1", isInline ? "max-w-2xl" : "max-w-md")}>
        <h3 className={cn("font-semibold", isCompact ? "text-base" : "text-lg")}>
          {title}
        </h3>
      {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
      )}
      </div>
      {action && (
        <Button variant="outline" onClick={action.onClick} size="sm">
          {action.label}
        </Button>
      )}
    </div>
  );
}
