import type { ReactNode } from "react";
import { Button } from "@repo/ds/components/ui/button";
import { cn } from "@repo/ds/lib/utils";
import { Loader2, Sparkles, X } from "@/lib/icons";
import type { CoachState } from "./coach-model";

/** Asks the coach on request. Lives in the definition section's header. */
export function CoachTrigger({
  state,
  onRun,
}: {
  state: CoachState;
  onRun: () => void;
}) {
  const running = state.kind === "running";
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 gap-1.5 px-2 text-primary-ink hover:text-primary-ink"
      onClick={onRun}
      disabled={running}
    >
      {running ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : (
        <Sparkles className="size-3.5" aria-hidden />
      )}
      {running ? "Suggesting" : "Suggest improvements"}
    </Button>
  );
}

/**
 * One AI suggestion, inline beside the part it would change (D-07, S-13). Apply only fills the
 * composer's fields; nothing is saved until the author saves the objective.
 */
export function CoachSuggestion({
  label,
  children,
  onApply,
  onDismiss,
}: {
  /** What it suggests, in the user's words: "title", "measure", "parent". */
  label: string;
  children: ReactNode;
  onApply: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="group"
      aria-label={`Suggested ${label}`}
      className="mt-2 flex animate-in items-start gap-3 rounded-control border border-border bg-inlay px-3 py-2.5 fade-in-0"
    >
      <Sparkles
        className="mt-0.5 size-4 shrink-0 text-primary-ink"
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="type-meta text-primary-ink">Suggested {label}</p>
        <div className="mt-0.5 text-sm text-foreground">{children}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="text-primary-ink hover:text-primary-ink"
          onClick={onApply}
        >
          Apply<span className="sr-only"> suggested {label}</span>
        </Button>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label={`Dismiss suggested ${label}`}
          onClick={onDismiss}
        >
          <X />
        </Button>
      </div>
    </div>
  );
}

/**
 * A field that carries its own AI suggestion (D-07, S-13): the suggestion sits inside the field's
 * frame, under what the author typed, so it reads as part of the field rather than a note beside it.
 * Without a suggestion the field renders as it is. Without a field (the parent while the objective is
 * not aligned yet) the suggestion keeps the field's frame on its own.
 */
export function CoachField({
  label,
  suggestion,
  onApply,
  onDismiss,
  children,
}: {
  /** What it suggests, in the user's words: "title", "parent". */
  label: string;
  suggestion: ReactNode | null;
  onApply: () => void;
  onDismiss: () => void;
  children?: ReactNode;
}) {
  if (suggestion === null) return <>{children}</>;
  return (
    <div className="overflow-hidden rounded-control border border-input transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
      {children ? (
        <div className="*:rounded-none! *:border-0! *:bg-transparent! *:shadow-none! *:ring-0!">
          {children}
        </div>
      ) : null}
      <div
        role="group"
        aria-label={`Suggested ${label}`}
        className={cn(
          "flex animate-in items-center gap-2.5 py-1.5 pe-1.5 ps-2.5 fade-in-0",
          children && "border-t border-border"
        )}
      >
        <Sparkles className="size-3.5 shrink-0 text-primary-ink" aria-hidden />
        <div className="min-w-0 flex-1 text-sm text-foreground">
          {suggestion}
        </div>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="text-primary-ink hover:text-primary-ink"
          onClick={onApply}
        >
          Apply<span className="sr-only"> suggested {label}</span>
        </Button>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label={`Dismiss suggested ${label}`}
          onClick={onDismiss}
        >
          <X />
        </Button>
      </div>
    </div>
  );
}

/** The coach looked and abstained on everything. */
export function CoachNothing() {
  return (
    <p
      className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"
      role="status"
    >
      <Sparkles className="size-3.5" aria-hidden />
      No suggestions for this objective
    </p>
  );
}

/** Marks a field the author filled from a suggestion, until they edit it. */
export function AiSuggestedTag() {
  return (
    <span className="ms-1.5 inline-flex items-center gap-1 text-xs font-normal text-primary-ink">
      <Sparkles className="size-3" aria-hidden />
      AI-suggested
    </span>
  );
}
