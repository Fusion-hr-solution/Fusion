"use client";

import { type LucideIcon, FileX2 } from "lucide-react";
import { Button } from "@repo/ui";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Reusable empty state component.
 * Shows when a list/table has no data.
 */
export function EmptyState({
  icon: Icon = FileX2,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-muted p-3 mb-4">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      {description && (
        <p className="text-muted-foreground text-sm max-w-md mb-4">{description}</p>
      )}
      {action && (
        <Button variant="outline" onClick={action.onClick} size="sm">
          {action.label}
        </Button>
      )}
    </div>
  );
}
