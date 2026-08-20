"use client";

import { cn } from "@repo/ds";
import { Check, FileSpreadsheet } from "lucide-react";
import { BaselineControl } from "./workforce-baseline";

/**
 * The one workspace frame every Workforce Import state renders inside. It owns the
 * consistent grammar — title, Workforce-as-of, source identity, and a progress spine —
 * so moving Source → Processing → Review → Ready never replaces the page, only the work
 * area. States supply their own content and (where relevant) a command region; they never
 * reinvent header hierarchy, width origin, or command placement.
 */

export type ImportStep = "source" | "reading" | "understanding" | "preparing" | "review" | "ready" | "applying";

const SPINE: Array<{ key: ImportStep; label: string }> = [
  { key: "source", label: "Source" },
  { key: "reading", label: "Read source" },
  { key: "understanding", label: "Understand columns" },
  { key: "review", label: "Review" },
];

/** Which spine node the current step maps to (processing steps collapse onto "Read/Understand"). */
const SPINE_INDEX: Record<ImportStep, number> = {
  source: 0,
  reading: 1,
  understanding: 2,
  preparing: 2,
  review: 3,
  ready: 3,
  applying: 3,
};

export function ImportShell({
  step,
  baseline,
  source,
  children,
  command,
}: {
  step: ImportStep;
  /** Committed workforce-as-of context, shown read-only once a source exists. */
  baseline?: string;
  source?: { fileName: string | null } | null;
  children: React.ReactNode;
  command?: React.ReactNode;
}) {
  return (
    <div className="flex h-[calc(100vh-var(--top-bar-height,3.5rem))] flex-col">
      <header className="shrink-0 border-b border-border px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div className="flex min-w-0 items-center gap-4">
            <h1 className="type-title font-semibold text-foreground">Import workforce</h1>
            {baseline ? <BaselineControl value={baseline} onChange={() => {}} compact /> : null}
          </div>
          <ProgressSpine step={step} />
        </div>
        {source?.fileName ? (
          <div className="mt-2 flex items-center gap-2 type-meta text-muted-foreground">
            <FileSpreadsheet className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{source.fileName}</span>
          </div>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>

      {command ? <div className="shrink-0 border-t border-border px-6 py-3">{command}</div> : null}
    </div>
  );
}

function ProgressSpine({ step }: { step: ImportStep }) {
  const current = SPINE_INDEX[step];
  const working = step === "reading" || step === "understanding" || step === "preparing";
  return (
    <ol className="flex items-center gap-1.5 type-meta">
      {SPINE.map((node, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={node.key} className="flex items-center gap-1.5">
            <span
              className={cn(
                "grid size-4 place-items-center rounded-full border text-[0.625rem] font-semibold tabular-nums transition-colors",
                done
                  ? "border-primary bg-primary text-primary-foreground"
                  : active
                    ? "border-primary text-primary"
                    : "border-border text-muted-foreground"
              )}
            >
              {done ? <Check className="size-2.5" aria-hidden /> : i + 1}
            </span>
            <span className={cn(active ? "font-medium text-foreground" : "text-muted-foreground", "hidden sm:inline")}>
              {node.label}
            </span>
            {active && working ? (
              <span className="ml-0.5 size-1.5 animate-pulse rounded-full bg-primary" aria-hidden />
            ) : null}
            {i < SPINE.length - 1 ? <span className="mx-1 h-px w-4 bg-border" aria-hidden /> : null}
          </li>
        );
      })}
    </ol>
  );
}

/** A left-aligned content column for the non-Review states, sharing the shell's px-6 origin. */
export function ImportContentColumn({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("px-6 py-8", className)}>{children}</div>;
}
