import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";

export interface WorkListItem {
  id: string;
  module: string;
  title: string;
  context?: string | null;
  /** ISO date (`yyyy-mm-dd`). */
  dueOn?: string | null;
  href: string;
  subject?: { displayName: string } | null;
}

export interface WorkListModule {
  key: string;
  label: string;
  status: "loading" | "ready" | "error";
}

/** Renders a link to an item's path; defaults to a plain anchor (a full navigation across apps). */
export type RenderWorkLink = (props: { href: string; className: string; children: ReactNode }) => ReactNode;

const defaultLink: RenderWorkLink = ({ href, className, children }) => (
  <a href={href} className={className}>
    {children}
  </a>
);

const DAY_MS = 86_400_000;

function dayNumber(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Date.UTC(y!, (m ?? 1) - 1, d ?? 1) / DAY_MS;
}

/** Whole days from `today` to `dueOn`: negative when overdue. */
export function daysUntil(dueOn: string, today: Date): number {
  const todayNumber = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / DAY_MS;
  return dayNumber(dueOn) - todayNumber;
}

export function dueLabel(dueOn: string, today: Date): string {
  const days = daysUntil(dueOn, today);
  if (days < -1) return `${-days} days overdue`;
  if (days === -1) return "1 day overdue";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `${days} days left`;
}

/** The one item that matters most: the earliest due, or the first (newest) when none is due. */
export function selectFeaturedWork<T extends WorkListItem>(items: readonly T[]): T | null {
  const dated = items.filter((item) => item.dueOn);
  if (dated.length > 0) {
    return dated.reduce((earliest, item) => (item.dueOn! < earliest.dueOn! ? item : earliest));
  }
  return items[0] ?? null;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

export interface WorkFocusProps {
  item: WorkListItem;
  moduleLabel: string;
  today?: Date;
  renderLink?: RenderWorkLink;
}

/** The featured work item: its module, title, how long is left, and the one action that opens it. */
export function WorkFocus({ item, moduleLabel, today, renderLink = defaultLink }: WorkFocusProps) {
  const reference = today ?? new Date();
  const days = item.dueOn ? daysUntil(item.dueOn, reference) : null;
  return (
    <section aria-label="Most important" className="flex flex-col gap-5 rounded-surface bg-card p-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        <p className="type-eyebrow text-muted-foreground">{moduleLabel}</p>
        <h2 className="type-section-title text-foreground">{item.title}</h2>
        {item.context ? <p className="type-body-secondary text-muted-foreground">{item.context}</p> : null}
      </div>
      <div className="flex shrink-0 items-end gap-6">
        {days !== null && item.dueOn ? (
          <div className="text-right">
            <p className={cn("type-metric", days < 0 ? "text-warning" : "text-foreground")}>
              {days < 0 ? -days : days}
            </p>
            <p className="type-meta text-muted-foreground">
              {days < 0 ? (days === -1 ? "day overdue" : "days overdue") : days === 1 ? "day left" : "days left"}
            </p>
          </div>
        ) : null}
        <Button asChild>{renderLink({ href: item.href, className: "", children: "Open" })}</Button>
      </div>
    </section>
  );
}

export interface WorkListProps {
  items: WorkListItem[];
  modules: WorkListModule[];
  today?: Date;
  renderLink?: RenderWorkLink;
  /** Shown when nothing needs the person and nothing is loading or failed. */
  emptyLabel?: string;
  className?: string;
}

/**
 * Everything else that needs the person, earliest due first, each row opening its path. A module
 * still loading keeps placeholder rows; a module that failed is named in one quiet line.
 */
export function WorkList({
  items,
  modules,
  today,
  renderLink = defaultLink,
  emptyLabel = "Nothing needs you right now",
  className,
}: WorkListProps) {
  const reference = today ?? new Date();
  const labels = new Map(modules.map((module) => [module.key, module.label]));
  const loading = modules.filter((module) => module.status === "loading");
  const failed = modules.filter((module) => module.status === "error");

  return (
    <div className={cn("space-y-2", className)}>
      {items.length === 0 && loading.length === 0 && failed.length === 0 ? (
        <p className="py-2 type-body-secondary text-muted-foreground">{emptyLabel}</p>
      ) : null}
      {items.length > 0 || loading.length > 0 ? (
        <ul className="divide-y divide-border overflow-hidden rounded-surface bg-card">
          {items.map((item) => {
            const days = item.dueOn ? daysUntil(item.dueOn, reference) : null;
            const moduleLabel = labels.get(item.module) ?? item.module;
            return (
              <li key={item.id}>
                {renderLink({
                  href: item.href,
                  className:
                    "group flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                  children: (
                    <>
                      <Avatar className="size-8 shrink-0">
                        <AvatarFallback className="text-xs">
                          {item.subject ? initials(item.subject.displayName) : moduleLabel.slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate type-body font-medium text-foreground">{item.title}</span>
                        <span className="block truncate type-meta text-muted-foreground">{item.context ?? moduleLabel}</span>
                      </span>
                      {item.dueOn && days !== null ? (
                        <span className={cn("shrink-0 type-meta", days < 0 ? "text-warning" : "text-muted-foreground")}>
                          {dueLabel(item.dueOn, reference)}
                        </span>
                      ) : null}
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden />
                    </>
                  ),
                })}
              </li>
            );
          })}
          {loading.map((module) => (
            <li key={`loading-${module.key}`} aria-busy aria-label={`Loading ${module.label} work`} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {failed.map((module) => (
        <p key={module.key} role="status" className="type-meta text-muted-foreground">
          {module.label} work couldn&apos;t be loaded
        </p>
      ))}
    </div>
  );
}
