"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "../primitives/button";
import { cn } from "../../lib/utils";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  layout?: "centered" | "inline";
  size?: "default" | "compact";
  className?: string;
}

/**
 * Reusable error state component.
 * Shows error message with optional retry button.
 * 
 * @example
 * ```tsx
 * <ErrorState
 *   title="Failed to load employees"
 *   message="Network error occurred"
 *   onRetry={() => refetch()}
 * />
 * ```
 */
export function ErrorState({
  title = "Something went wrong",
  message = "An error occurred while loading data.",
  onRetry,
  layout = "centered",
  size = "default",
  className,
}: ErrorStateProps) {
  const isInline = layout === "inline";
  const isCompact = size === "compact";

  return (
    <div
      className={cn(
        "flex flex-col",
        isInline
          ? "items-start justify-start gap-3 rounded-lg border border-dashed border-destructive/20 bg-destructive/5 p-4 text-left"
          : "items-center justify-center px-4 py-12 text-center",
        className
      )}
    >
      <div
        className={cn(
          "rounded-full bg-destructive/10",
          isCompact ? "p-2" : "p-3"
        )}
      >
        <AlertCircle className="h-6 w-6 text-destructive" />
      </div>
      <div className={cn("space-y-1", isInline ? "max-w-2xl" : "max-w-md")}>
        <h3 className={cn("font-semibold", isCompact ? "text-base" : "text-lg")}>
          {title}
        </h3>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try again
        </Button>
      )}
    </div>
  );
}
