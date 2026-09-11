import type { ReactNode } from "react";
import { Label } from "@repo/ds/components/ui/label";

/** Builds the `aria-describedby` for a field that may carry a hint and an error. */
export function describedBy(id: string, hasError: boolean): string | undefined {
  const ids = [`${id}-hint`, hasError ? `${id}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

/**
 * A labelled field with an optional hint and error, shared across the
 * provisioning steps so every input reads and reports the same way.
 */
export function Field({
  id,
  label,
  required = false,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {/* The asterisk is decorative; the requirement is announced by the
            input's own validity, and spelled out for anyone reading the label. */}
        {required ? (
          <>
            <span aria-hidden="true" className="ml-0.5 text-destructive">
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        ) : null}
      </Label>

      {children}

      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
