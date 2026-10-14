"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { PageContainer } from "@repo/ds/shell";
import { Button } from "@repo/ds/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@repo/ds/components/ui/sheet";
import { Skeleton } from "@repo/ds/components/ui/skeleton";
import { cn } from "@repo/ds/lib/utils";
import type { ObjectiveRecord, RecordSectionId } from "./objective-record-model";
import { resolveSections } from "./objective-record-model";

// The objective's accent, inherited by every accent inside: amber for direction and aligned objectives,
// blue for a standalone plan objective — the colour its card carries everywhere else.
const ACCENT: Record<ObjectiveRecord["accent"], { className: string; style: CSSProperties }> = {
  primary: {
    className: "[--type-tint:var(--primary-tint)] [--type-ring:var(--primary-ring)] [--type-ink:var(--primary-ink)]",
    style: { "--type-accent": "var(--primary)" } as CSSProperties,
  },
  info: {
    className:
      "[--type-tint:color-mix(in_oklab,var(--info)_10%,transparent)] [--type-ring:color-mix(in_oklab,var(--info)_20%,transparent)] [--type-ink:var(--info)]",
    style: { "--type-accent": "var(--info)" } as CSSProperties,
  },
};

export type RecordSheetState =
  | { status: "loading" }
  | { status: "denied" }
  | { status: "error"; onRetry: () => void }
  | { status: "ready"; record: ObjectiveRecord };

/**
 * The record's shell and nothing more: a right-hand sheet with a header, the body the model resolves,
 * and an action area. It knows no section's logic — `renderSection` draws each section, `header` and
 * `actions` are supplied — so the same record composes identically wherever it is opened, and sections
 * stay reusable on their own. `task` replaces header-and-body while a task mode (recording progress) runs.
 */
export function ObjectiveRecordSheet({
  open,
  onOpenChange,
  state,
  header,
  renderSection,
  actions,
  task,
  presentation = "sheet",
  cycleName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: RecordSheetState;
  header: (record: ObjectiveRecord) => ReactNode;
  renderSection: (id: RecordSectionId, record: ObjectiveRecord, options: { paired: boolean }) => ReactNode;
  actions: (record: ObjectiveRecord) => ReactNode;
  task?: ReactNode;
  presentation?: "sheet" | "page";
  cycleName?: string;
}) {
  const accent = ACCENT[state.status === "ready" ? state.record.accent : "primary"];

  if (presentation === "page") {
    return (
      <PageContainer>
        <article className={cn("space-y-6", accent.className)} style={accent.style}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="type-meta text-muted-foreground hover:text-foreground">Overview</Link>
            <span className="type-meta text-muted-foreground">{cycleName}</span>
          </div>
          {state.status === "ready" ? (
            <>
              <header className="border-b border-border pb-6">{header(state.record)}</header>
              {task ?? (
                <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
                  <div className="min-w-0 space-y-5">
                    {resolveSections(state.record).map((row) => (
                      <div key={typeof row === "string" ? row : row.join("+")} className={typeof row === "string" ? undefined : "grid gap-5 sm:grid-cols-2"}>
                        {(typeof row === "string" ? [row] : row).map((id) => (
                          <div key={id}>{renderSection(id, state.record, { paired: false })}</div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <aside className="min-w-0 lg:sticky lg:top-6">{actions(state.record)}</aside>
                </div>
              )}
            </>
          ) : state.status === "loading" ? (
            <div className="max-w-3xl space-y-5" aria-label="Loading objective">
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-32 w-full rounded-surface" />
              <Skeleton className="h-48 w-full rounded-surface" />
            </div>
          ) : (
            <div className="space-y-4 py-12">
              <h1 className="type-page-title">{state.status === "denied" ? "This objective isn't available to you" : "This objective could not be loaded"}</h1>
              {state.status === "error" ? <Button variant="outline" onClick={state.onRetry}>Try again</Button> : null}
            </div>
          )}
        </article>
      </PageContainer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={cn(
          "flex w-full flex-col gap-0 overflow-hidden bg-inlay p-0 dark:bg-popover data-[side=right]:sm:max-w-[540px]",
          accent.className
        )}
        style={accent.style}
      >
        {state.status === "ready" ? (
          <>
            <div className="border-b border-border p-5 pr-12">{header(state.record)}</div>
            <SheetDescription className="sr-only">Objective record for {state.record.title}.</SheetDescription>
            {task ?? (
              <>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                  {resolveSections(state.record).map((row) =>
                    typeof row === "string" ? (
                      <div key={row}>{renderSection(row, state.record, { paired: false })}</div>
                    ) : (
                      <div key={row.join("+")} className="grid grid-cols-2 gap-4">
                        {row.map((id) => (
                          <div key={id} className="flex">
                            <div className="w-full [&>section]:h-full">{renderSection(id, state.record, { paired: true })}</div>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>
                {actions(state.record)}
              </>
            )}
          </>
        ) : state.status === "loading" ? (
          <RecordLoading />
        ) : (
          <RecordUnavailable
            title={state.status === "denied" ? "This objective isn't available to you" : "This objective could not be loaded"}
            onRetry={state.status === "error" ? state.onRetry : undefined}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function RecordLoading() {
  return (
    <>
      <div className="border-b border-border p-5 pr-12">
        <SheetTitle className="sr-only">Objective</SheetTitle>
        <SheetDescription className="sr-only">Loading the objective.</SheetDescription>
        <div className="flex items-start gap-3.5">
          <Skeleton className="size-10 shrink-0 rounded-control" />
          <div className="w-full space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <Skeleton className="h-16 w-full rounded-surface" />
        <Skeleton className="h-32 w-full rounded-surface" />
        <Skeleton className="h-28 w-full rounded-surface" />
      </div>
    </>
  );
}

function RecordUnavailable({ title, onRetry }: { title: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <SheetTitle className="text-base">{title}</SheetTitle>
      <SheetDescription className="sr-only">{title}</SheetDescription>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
