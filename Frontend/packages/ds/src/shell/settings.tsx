"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, ChevronRight, Eye } from "lucide-react";
import { cn } from "../lib/utils";
import { formatDate, formatRelative } from "../lib/dates";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { Spinner } from "../components/ui/spinner";

// ── Fusion Settings page parts (B-071 D4) ──
//
// Every settings section is one centred column: the title in Lora, who changed it last, then blocks of rows.
// A view-only reader gets the same rows with values as text, and no save bar.

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0]![0]}${parts[parts.length - 1]![0]}` : (parts[0] ?? "").slice(0, 2);
  return letters.toUpperCase() || "?";
}

/** "a minute ago" within a day, else "on 2 Sep 2026". */
export function settingsWhen(at: string, now: Date = new Date()): string {
  const date = new Date(at);
  if (now.getTime() - date.getTime() < 86_400_000) {
    const relative = formatRelative(date, now);
    return relative === "Just now" ? "just now" : relative;
  }
  return `on ${formatDate(date, { year: "always", now })}`;
}

export interface SettingsLastChangeValue {
  at: string;
  actorName: string;
}

/** Who changed the section last and when, or when it was set up. Nothing while neither is known. */
export function LastChange({
  change,
  setUpAt,
  now,
}: {
  change?: SettingsLastChangeValue | null;
  setUpAt?: string | null;
  now?: Date;
}) {
  if (change) {
    return (
      <p className="flex items-center gap-2 type-meta text-muted-foreground">
        <span
          aria-hidden
          className="grid size-5 shrink-0 place-items-center rounded-full bg-inlay text-[9px] font-semibold text-foreground/85 ring-1 ring-border"
        >
          {initials(change.actorName)}
        </span>
        <span>
          <span className="font-semibold text-foreground">{change.actorName}</span> changed it {settingsWhen(change.at, now)}
        </span>
      </p>
    );
  }
  if (setUpAt) {
    return <p className="type-meta text-muted-foreground">Set up {settingsWhen(setUpAt, now)}</p>;
  }
  return null;
}

/** The quiet "View only" mark on a section a person can read but not change. */
export function ViewOnlyBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-control border border-border bg-inlay px-2 py-1 type-meta text-muted-foreground",
        className,
      )}
    >
      <Eye aria-hidden className="size-3.5" />
      View only
    </span>
  );
}

/** "Saved", shown for a moment after a personal setting saves on change. */
export function SettingsSaved({ at }: { at: number | null }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (at === null) return;
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 2400);
    return () => window.clearTimeout(timer);
  }, [at]);
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-control bg-success-subtle px-2 py-1 type-meta font-semibold text-success transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <Check aria-hidden className="size-3.5" />
      {visible ? "Saved" : null}
    </span>
  );
}

export interface SettingsPageProps {
  title: string;
  /** Under the title: who changed it last (or when it was set up). */
  lastChange?: SettingsLastChangeValue | null;
  setUpAt?: string | null;
  /** Under the title instead of a last change, for a section nobody here changes. */
  note?: ReactNode;
  /** The section is view-only for this person. */
  viewOnly?: boolean;
  /** Right of the title, such as `SettingsSaved`. */
  aside?: ReactNode;
  /** Roles: a list beside the role it opens needs 960px. */
  wide?: boolean;
  /** Values still loading: the title shows, the rows wait. */
  loading?: boolean;
  children?: ReactNode;
}

/** One settings section: title, last change, then its blocks. The frame and title render before the values. */
export function SettingsPage({ title, lastChange, setUpAt, note, viewOnly, aside, wide, loading, children }: SettingsPageProps) {
  return (
    <div className={cn("mx-auto w-full px-6 pt-10 pb-16", wide ? "max-w-[960px]" : "max-w-[760px]")}>
      <header className="mb-8 flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="type-page-title">{title}</h1>
          {note ? (
            <p className="type-meta text-muted-foreground">{note}</p>
          ) : loading && !lastChange && !setUpAt ? (
            <Skeleton className="h-4 w-60" />
          ) : (
            <LastChange change={lastChange} setUpAt={setUpAt} />
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-2">
          {viewOnly ? <ViewOnlyBadge /> : null}
          {aside}
        </div>
      </header>
      {loading ? <SettingsSkeleton /> : <div className="flex flex-col gap-10">{children}</div>}
    </div>
  );
}

/** Stable placeholders while a section's values load. */
export function SettingsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-busy aria-label="Loading settings" className="flex flex-col gap-3">
      <Skeleton className="h-5 w-32" />
      <div className="overflow-hidden rounded-surface border border-border bg-card">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-b-0">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="ml-auto h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export interface SettingsBlockProps {
  title?: ReactNode;
  /** Beside the title, quiet: "This device", "2 on". */
  meta?: ReactNode;
  /** At the end of the title line, such as an add action. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A group of related settings under one heading. */
export function SettingsBlock({ title, meta, action, children, className }: SettingsBlockProps) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      {title || action ? (
        <div className="flex items-baseline justify-between gap-3">
          {title ? (
            <h2 className="flex items-baseline gap-2.5 type-subsection-title">
              {title}
              {meta ? <span className="type-meta font-normal text-muted-foreground">{meta}</span> : null}
            </h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** The rows of a block: one object, rows separated by hairlines. */
export function SettingsRows({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-surface border border-border bg-card", className)}>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

export interface SettingsRowProps {
  label: ReactNode;
  /** Only for a real constraint or consequence; never a restated label. */
  description?: ReactNode;
  /** The control, or the value as text for a view-only reader. */
  children?: ReactNode;
  /** Id of the control the label names. */
  htmlFor?: string;
  className?: string;
}

/** One setting: its label on the left, its control or value on the right. */
export function SettingsRow({ label, description, children, htmlFor, className }: SettingsRowProps) {
  const Label = htmlFor ? "label" : "div";
  return (
    <div className={cn("flex min-h-[62px] items-center gap-6 px-5 py-3", className)}>
      <Label htmlFor={htmlFor} className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="type-label font-semibold text-foreground">{label}</span>
        {description ? <span className="type-meta text-muted-foreground">{description}</span> : null}
      </Label>
      {children !== undefined ? <div className="flex shrink-0 items-center gap-2.5">{children}</div> : null}
    </div>
  );
}

/** A value read, not edited. */
export function SettingsValue({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("text-right text-sm font-semibold text-foreground", className)}>{children}</span>;
}

export interface SettingsConflict {
  /** Who saved first, and when. */
  actorName: string;
  at: string;
  /** The section they saved. */
  section: string;
}

export interface SettingsSaveBarProps {
  changes: number;
  /** What saving does, in one sentence. */
  consequence?: ReactNode;
  saving?: boolean;
  /** The save failed for another reason: what happened, in one line. */
  error?: string | null;
  conflict?: SettingsConflict | null;
  /** Someone saved first, but who isn't known yet. */
  conflictPending?: boolean;
  onDiscard: () => void;
  onSave: () => void;
  onReload: () => void;
  /** Label of the save action ("Save", "Save version 2"). */
  saveLabel?: string;
}

/**
 * Staged edits wait here: how many, what saving does, Discard and Save. When someone saved the section first, it
 * names them and offers Reload instead.
 */
export function SettingsSaveBar({
  changes,
  consequence,
  saving = false,
  error,
  conflict,
  conflictPending = false,
  onDiscard,
  onSave,
  onReload,
  saveLabel = "Save",
}: SettingsSaveBarProps) {
  const conflicted = Boolean(conflict) || conflictPending;
  if (changes === 0 && !conflicted) return null;
  return (
    <div className="sticky bottom-6 z-10 mt-10">
      <div
        role="region"
        aria-label="Unsaved changes"
        className={cn(
          "flex items-center gap-4 rounded-surface border bg-popover px-5 py-3.5 shadow-overlay",
          conflicted ? "border-destructive/40" : "border-border",
        )}
      >
        <span aria-hidden className={cn("size-2 shrink-0 rounded-full", conflicted ? "bg-destructive" : "bg-primary")} />
        {conflicted ? (
          <p className="min-w-0 flex-1 text-sm text-foreground/85" role="alert">
            {conflict ? (
              <span className="font-semibold text-foreground">
                {conflict.actorName} saved {conflict.section} {settingsWhen(conflict.at)}.
              </span>
            ) : (
              <span className="font-semibold text-foreground">Someone saved this section after you opened it.</span>
            )}{" "}
            Reload to see their version; your change is lost.
          </p>
        ) : (
          <>
            <span className="shrink-0 text-sm font-semibold text-foreground">
              {changes === 1 ? "1 change" : `${changes} changes`}
            </span>
            <p className={cn("min-w-0 flex-1 text-sm", error ? "text-destructive" : "text-foreground/85")} role={error ? "alert" : undefined}>
              {error ?? consequence}
            </p>
          </>
        )}
        <div className="flex shrink-0 items-center gap-2">
          {conflicted ? (
            <Button size="sm" onClick={onReload}>
              Reload
            </Button>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={onDiscard} disabled={saving}>
                Discard
              </Button>
              <Button size="sm" onClick={onSave} disabled={saving}>
                {saving ? <Spinner className="size-3.5" /> : null}
                {saveLabel}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** "Settings › Core HR › Company": where the person is inside Settings. Earlier steps are quiet text. */
export function SettingsBreadcrumb({ trail }: { trail: readonly string[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex min-w-0 items-center gap-2 text-sm">
        <li>
          <a href="/settings" className="text-muted-foreground transition-colors hover:text-foreground">
            Settings
          </a>
        </li>
        {trail.map((step, index) => {
          const last = index === trail.length - 1;
          return (
            <li key={`${step}-${index}`} className="flex min-w-0 items-center gap-2">
              <ChevronRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground/70" />
              <span
                aria-current={last ? "page" : undefined}
                className={cn("truncate", last ? "font-semibold text-foreground" : "text-muted-foreground")}
              >
                {step}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
