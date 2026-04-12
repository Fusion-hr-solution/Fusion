"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}

/**
 * Confirmation dialog for destructive or important actions.
 * Uses the core design system tokens.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleConfirm = React.useCallback(async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // Error handling is done by the caller
    } finally {
      setIsSubmitting(false);
    }
  }, [onConfirm, onOpenChange]);

  const isBusy = loading || isSubmitting;
  const isDestructive = variant === "destructive";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "core-ui-root border-ch-outline-variant/30 bg-white font-chBody sm:max-w-[425px]",
          "[&>button]:text-ch-on-surface-variant [&>button]:hover:text-ch-on-surface"
        )}
      >
        <DialogHeader>
          <div className="flex items-start gap-4">
            {isDestructive && (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ch-error-container">
                <AlertTriangle className="h-5 w-5 text-ch-error" />
              </div>
            )}
            <div className="flex-1">
              <DialogTitle className="font-chHeadline text-lg font-bold text-ch-on-surface">
                {title}
              </DialogTitle>
              <DialogDescription className="mt-2 text-sm text-ch-on-surface-variant">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="mt-6 gap-2 sm:gap-2">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onOpenChange(false)}
            className="rounded-ch-md border border-ch-outline-variant/50 bg-white px-4 py-2.5 text-sm font-semibold text-ch-on-surface transition-colors hover:bg-ch-surface-container-low disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void handleConfirm()}
            className={cn(
              "inline-flex items-center gap-2 rounded-ch-md px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50",
              isDestructive
                ? "bg-ch-error text-ch-on-error hover:bg-ch-error/90"
                : "bg-ch-primary text-ch-on-primary hover:bg-ch-primary/90"
            )}
          >
            {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
