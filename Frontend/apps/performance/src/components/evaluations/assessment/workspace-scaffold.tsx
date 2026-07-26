"use client";

import type { ReactNode } from "react";
import { CalendarClock, Check, CircleAlert, Loader2 } from "lucide-react";
import type { AssessmentIncompleteItemDto } from "@repo/api";
import { Button } from "@repo/ds";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/labels";
import type { AutosaveStatus } from "./use-assessment-autosave";
import {
  assessmentItemAnchor,
  assessmentSectionAnchor,
} from "./incomplete-blockers";
import { evaluationTerms } from "./evaluation-terms";

/**
 * Shared assessment workspace shape: a content column of full-width section
 * bands plus a sticky right rail that carries progress (doubling as anchor
 * navigation), the autosave state, the deadline, submission blockers, and the
 * one decisive action. No floating buttons, no detached error text.
 */
export function WorkspaceScaffold({
  children,
  rail,
}: {
  children: ReactNode;
  rail: ReactNode;
}) {
  return (
    <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-10">{children}</div>
      <aside className="xl:sticky xl:top-6">{rail}</aside>
    </div>
  );
}

export function WorkspaceSection({
  id,
  title,
  meta,
  children,
}: {
  id: string;
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={assessmentSectionAnchor(id)}
      aria-label={title}
      className="flex scroll-mt-24 flex-col gap-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {meta}
      </div>
      {children}
    </section>
  );
}

export interface RailSection {
  id: string;
  label: string;
  done: number;
  total: number;
}

export function SaveStateChip({ status }: { status: AutosaveStatus }) {
  if (status === "idle") return null;
  if (status === "saving")
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Loader2 aria-hidden className="size-3 animate-spin" />
        {evaluationTerms.saving}
      </span>
    );
  if (status === "saved")
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Check aria-hidden className="size-3 text-emerald-600 dark:text-emerald-400" />
        {evaluationTerms.saved}
      </span>
    );
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-destructive">
      <CircleAlert aria-hidden className="size-3" />
      {status === "conflict"
        ? evaluationTerms.saveConflict
        : "Changes not saved — retrying on your next edit."}
    </span>
  );
}

export function WorkspaceRail({
  sections,
  saveStatus = "idle",
  deadline,
  blockers = [],
  notice,
  action,
  onReload,
}: {
  sections: RailSection[];
  saveStatus?: AutosaveStatus;
  deadline?: string | null;
  blockers?: AssessmentIncompleteItemDto[];
  notice?: ReactNode;
  action?: ReactNode;
  onReload?: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <nav aria-label="Sections" className="flex flex-col gap-2.5">
        {sections.map((section) => {
          const complete = section.total > 0 && section.done >= section.total;
          return (
            <a
              key={section.id}
              href={`#${assessmentSectionAnchor(section.id)}`}
              className="group flex items-center gap-3"
            >
              <span
                className={cn(
                  "flex-1 truncate text-sm font-medium",
                  complete ? "text-muted-foreground" : "text-foreground",
                  "group-hover:text-primary"
                )}
              >
                {section.label}
              </span>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  complete
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
                )}
              >
                {section.done}/{section.total}
              </span>
              <span
                aria-hidden
                className="h-1 w-12 overflow-hidden rounded-full bg-muted"
              >
                <span
                  className={cn(
                    "block h-full rounded-full",
                    complete
                      ? "bg-emerald-600 dark:bg-emerald-400"
                      : "bg-primary"
                  )}
                  style={{
                    width: `${section.total > 0 ? Math.round((section.done / section.total) * 100) : 0}%`,
                  }}
                />
              </span>
            </a>
          );
        })}
      </nav>

      {deadline ? (
        <div className="flex items-center gap-2 border-t border-border pt-3 text-sm text-muted-foreground">
          <CalendarClock aria-hidden className="size-4 shrink-0" />
          <span>Due {formatDate(deadline)}</span>
        </div>
      ) : null}

      {notice}

      {blockers.length > 0 ? (
        <ul className="flex flex-col gap-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          {blockers.map((blocker) => (
            <li key={blocker.id}>
              <a
                href={`#${assessmentItemAnchor(blocker.id)}`}
                className="flex items-baseline gap-2 text-sm hover:text-primary"
              >
                <span className="text-xs text-muted-foreground">
                  {blocker.section}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {blocker.label}
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {saveStatus === "conflict" && onReload ? (
        <Button type="button" variant="outline" className="w-full" onClick={onReload}>
          {evaluationTerms.reload}
        </Button>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <SaveStateChip status={saveStatus} />
      </div>

      {action}
    </div>
  );
}
