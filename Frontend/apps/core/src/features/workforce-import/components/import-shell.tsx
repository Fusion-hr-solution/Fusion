"use client";

import { cn } from "@repo/ds";
import { ChevronRight, FileSpreadsheet } from "lucide-react";
import { BaselineControl } from "./workforce-baseline";

/**
 * The one workspace frame every Workforce Import state renders inside. It owns the
 * consistent grammar — title, Workforce-as-of, source identity, a quiet journey, and a
 * Source-details slot — so moving Source → Processing → Review → Ready never replaces the
 * page, only the work area. States supply their own content and (where relevant) a command
 * region; they never reinvent header hierarchy, width origin, or command placement.
 */

export type ImportStep = "source" | "reading" | "understanding" | "preparing" | "review" | "ready" | "applying";

const JOURNEY = ["Source", "Understand columns", "Review"] as const;

/** Which journey node the current step sits on (processing steps fold onto their business phase). */
const JOURNEY_INDEX: Record<ImportStep, number> = {
  source: 0,
  reading: 0,
  understanding: 1,
  preparing: 1,
  review: 2,
  ready: 2,
  applying: 2,
};

export function ImportShell({
  step,
  baseline,
  source,
  sourceActions,
  children,
  command,
}: {
  step: ImportStep;
  /** Committed workforce-as-of context, shown read-only once a source exists. */
  baseline?: string;
  source?: { fileName: string | null } | null;
  /** Source-details / replace / discard control, rendered in the header once a session exists. */
  sourceActions?: React.ReactNode;
  children: React.ReactNode;
  command?: React.ReactNode;
}) {
  return (
    <div className="flex h-[calc(100vh-var(--top-bar-height,3.5rem))] flex-col">
      <header className="shrink-0 border-b border-border px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="type-title font-semibold text-foreground">Import workforce</h1>
            {source?.fileName ? (
              <span className="flex min-w-0 items-center gap-1.5 type-meta text-muted-foreground">
                <FileSpreadsheet className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{source.fileName}</span>
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <Journey step={step} />
            {baseline ? <BaselineControl value={baseline} onChange={() => {}} compact /> : null}
            {sourceActions}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>

      {command ? <div className="shrink-0 border-t border-border px-6 py-3">{command}</div> : null}
    </div>
  );
}

/** A quiet three-beat journey — the same wayfinding the on-ramp shows, not a heavy numbered stepper. */
function Journey({ step }: { step: ImportStep }) {
  const current = JOURNEY_INDEX[step];
  return (
    <ol className="hidden items-center gap-1.5 type-meta md:flex" aria-label="Import steps">
      {JOURNEY.map((label, i) => (
        <li key={label} className="flex items-center gap-1.5">
          <span
            className={cn(
              i === current ? "font-medium text-foreground" : i < current ? "text-muted-foreground" : "text-muted-foreground/45"
            )}
          >
            {label}
          </span>
          {i < JOURNEY.length - 1 ? <ChevronRight className="size-3 text-muted-foreground/40" aria-hidden /> : null}
        </li>
      ))}
    </ol>
  );
}

/** A left-aligned content column for the non-Review states, sharing the shell's px-6 origin. */
export function ImportContentColumn({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("px-6 py-8", className)}>{children}</div>;
}
