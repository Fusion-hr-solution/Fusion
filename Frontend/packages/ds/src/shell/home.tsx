import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "../lib/utils";
import { formatDate } from "../lib/dates";
import { Button } from "../components/ui/button";
import { daysUntil, type RenderWorkLink, type WorkListItem, type WorkListModule } from "./work-list";

/** Something dated that isn't work: a 1:1, a deadline, a cycle's end. */
export interface HomeMoment {
  id: string;
  module: string;
  kind: string;
  title: string;
  context?: string | null;
  /** ISO date (`yyyy-mm-dd`). */
  date: string;
  /** ISO UTC instant when the moment has a time. */
  at?: string | null;
  href: string;
  /** Work-item kinds this moment summarizes on its date. */
  covers?: string[] | null;
}

/** A work item as the home leads with it: with the kind (for agenda dedupe) and the steps of its path. */
export interface HomeWorkItem extends WorkListItem {
  kind?: string;
}

export type HomeLead<T extends HomeWorkItem = HomeWorkItem> =
  | { kind: "work"; item: T }
  | { kind: "moment"; moment: HomeMoment }
  | null;

const defaultLink: RenderWorkLink = ({ href, className, children }) => (
  <a href={href} className={className}>
    {children}
  </a>
);

/** The local calendar day of a moment: its time's day when it has one, else its date. */
export function momentDay(moment: HomeMoment): string {
  if (!moment.at) return moment.date;
  const at = new Date(moment.at);
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
}

/**
 * The one thing the home leads with (fusion-home): an overdue item first, else the earliest due, else the first
 * undated item in module order; with no work, the next upcoming moment. Null when there is nothing at all.
 */
export function selectLead<T extends HomeWorkItem>(work: readonly T[], moments: readonly HomeMoment[], today: Date): HomeLead<T> {
  const dated = work.filter((item) => item.dueOn);
  const overdue = dated.filter((item) => daysUntil(item.dueOn!, today) < 0);
  const earliest = (items: T[]) => items.reduce((first, item) => (item.dueOn! < first.dueOn! ? item : first));
  if (overdue.length > 0) return { kind: "work", item: earliest(overdue) };
  if (dated.length > 0) return { kind: "work", item: earliest(dated) };
  if (work.length > 0) return { kind: "work", item: work[0]! };
  const next = [...moments].sort((a, b) => (a.at ?? `${a.date}T23:59`) < (b.at ?? `${b.date}T23:59`) ? -1 : 1)[0];
  return next ? { kind: "moment", moment: next } : null;
}

const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short" });

function localDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

/** "Sat 31 Oct" (the year outside this year). */
export function shortDay(isoDate: string): string {
  return formatDate(isoDate, { weekday: true });
}

function Steps({ steps }: { steps: NonNullable<WorkListItem["steps"]> }) {
  return (
    <ol className="flex items-start" aria-label="Where this stands">
      {steps.map((step, index) => (
        <li key={`${step.label}-${index}`} className="relative min-w-0 flex-1 pr-3">
          {index < steps.length - 1 ? (
            <span
              aria-hidden
              className={cn("absolute top-3 right-1 left-8 h-px", step.state === "done" ? "bg-success" : "bg-border")}
            />
          ) : null}
          <span
            className={cn(
              "relative grid size-6 place-items-center rounded-detail text-[11px] font-bold ring-1 ring-inset",
              step.state === "done" && "bg-success text-background ring-success",
              step.state === "current" && "bg-primary/15 text-primary ring-primary",
              step.state === "upcoming" && "bg-inlay text-muted-foreground ring-border",
            )}
          >
            {step.state === "done" ? <Check className="size-3.5" aria-hidden /> : index + 1}
          </span>
          <span className="mt-2 block truncate type-label text-foreground">
            <span className={cn(step.state === "current" && "text-primary")}>{step.label}</span>
            <span className="sr-only">{step.state === "done" ? " (done)" : step.state === "current" ? " (now)" : ""}</span>
          </span>
          {step.detail ? <span className="block truncate type-meta text-muted-foreground">{step.detail}</span> : null}
        </li>
      ))}
    </ol>
  );
}

export interface LeadFocusProps {
  lead: HomeLead;
  moduleLabel: (key: string) => string;
  today?: Date;
  renderLink?: RenderWorkLink;
}

/**
 * The home's lead: the work that matters most (its module, title, context, steps, time left or late, one action), or
 * with no work the next dated moment, or a plain statement that nothing needs the person and nothing is scheduled.
 */
export function LeadFocus({ lead, moduleLabel, today, renderLink = defaultLink }: LeadFocusProps) {
  const reference = today ?? new Date();

  if (lead?.kind === "work") {
    const item = lead.item;
    const days = item.dueOn ? daysUntil(item.dueOn, reference) : null;
    const late = days !== null && days < 0;
    return (
      <section aria-label="Most important" className="flex flex-col gap-6 rounded-surface bg-primary/10 p-6 ring-1 ring-inset ring-primary/40">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <p className="type-meta">
              <span className="font-semibold text-primary">{moduleLabel(item.module)}</span>
              {item.context ? <span className="ml-2 text-muted-foreground">{item.context}</span> : null}
            </p>
            <h2 className="type-section-title text-foreground">{item.title}</h2>
            {item.subject ? <p className="type-body-secondary text-muted-foreground">{item.subject.displayName}</p> : null}
          </div>
          {days !== null && item.dueOn ? (
            <div className="shrink-0 text-right">
              <p className={cn("type-metric", late ? "text-warning" : "text-primary")}>
                {Math.abs(days)}
                <span className="ml-1.5 type-body font-semibold text-foreground">
                  {late ? (days === -1 ? "day late" : "days late") : days === 1 ? "day left" : days === 0 ? "due today" : "days left"}
                </span>
              </p>
              <p className="type-meta text-muted-foreground">Due {shortDay(item.dueOn)}</p>
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          {item.steps?.length ? <div className="min-w-0 flex-1"><Steps steps={item.steps} /></div> : <span />}
          <Button asChild className="shrink-0">{renderLink({ href: item.href, className: "", children: item.actionLabel ?? "Open" })}</Button>
        </div>
      </section>
    );
  }

  if (lead?.kind === "moment") {
    const moment = lead.moment;
    const day = momentDay(moment);
    const days = daysUntil(day, reference);
    return (
      <section aria-label="Next" className="flex flex-col gap-4 rounded-surface bg-card p-6">
        <p className="type-meta text-muted-foreground">
          Nothing needs you today <span aria-hidden>·</span> <span className="font-semibold text-foreground">Next</span>
        </p>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <span className="grid w-[76px] shrink-0 place-items-center rounded-inset bg-primary/10 py-2 ring-1 ring-inset ring-primary/40">
            <span className="type-eyebrow text-primary">{WEEKDAY.format(localDate(day))}</span>
            <span className="type-section-title tabular-nums text-primary">
              {moment.at ? TIME.format(new Date(moment.at)) : localDate(day).getDate()}
            </span>
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="type-section-title text-foreground">{moment.title}</h2>
            <p className="type-body-secondary text-muted-foreground">
              {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`}
              {moment.context ? ` · ${moment.context}` : ""}
            </p>
          </div>
          <Button asChild variant="outline" className="shrink-0">
            {renderLink({ href: moment.href, className: "", children: moment.kind === "one-on-one" ? "Open the 1:1" : "View" })}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Next" className="space-y-2 rounded-surface bg-card p-6">
      <p className="type-meta text-muted-foreground">Nothing needs you right now</p>
      <h2 className="type-section-title text-foreground">No work and nothing scheduled in the next two weeks</h2>
    </section>
  );
}

interface AgendaEntry {
  id: string;
  day: string;
  at: string | null;
  title: string;
  context: string | null;
  href: string;
  due: boolean;
}

export interface HomeAgendaProps {
  work: readonly HomeWorkItem[];
  moments: readonly HomeMoment[];
  /** The lead, which the agenda doesn't repeat. */
  lead: HomeLead;
  modules: readonly WorkListModule[];
  today?: Date;
  days?: number;
  renderLink?: RenderWorkLink;
}

/** The entries of the next two weeks: dated work and moments by day, the lead and covered work left out. */
export function agendaEntries({ work, moments, lead, today, days = 14 }: Omit<HomeAgendaProps, "modules" | "renderLink">): AgendaEntry[] {
  const reference = today ?? new Date();
  const inWindow = (day: string) => {
    const offset = daysUntil(day, reference);
    return offset >= 0 && offset <= days;
  };
  const covered = (item: HomeWorkItem) => moments.some((m) =>
    m.module === item.module && momentDay(m) === item.dueOn && (m.covers ?? []).includes(item.kind ?? ""));
  const leadId = lead?.kind === "work" ? lead.item.id : lead?.kind === "moment" ? lead.moment.id : null;

  const entries: AgendaEntry[] = [
    ...moments.filter((m) => m.id !== leadId && inWindow(momentDay(m))).map((m) => ({
      id: m.id, day: momentDay(m), at: m.at ?? null, title: m.title, context: m.context ?? null, href: m.href, due: !m.at,
    })),
    ...work.filter((w) => w.id !== leadId && w.dueOn && inWindow(w.dueOn) && !covered(w)).map((w) => ({
      id: w.id, day: w.dueOn!, at: null, title: `${w.title} due`, context: w.context ?? null, href: w.href, due: true,
    })),
  ];
  return entries.sort((a, b) => (a.day !== b.day ? (a.day < b.day ? -1 : 1) : (a.at ?? "~") < (b.at ?? "~") ? -1 : 1));
}

/**
 * The next two weeks on the home: dated work and moments from every entitled module, by day, earliest first, each
 * opening its path. A module that couldn't answer is named in one quiet line.
 */
export function HomeAgenda(props: HomeAgendaProps): ReactNode {
  const { modules, renderLink = defaultLink } = props;
  const entries = agendaEntries(props);
  const failed = modules.filter((module) => module.status === "error");
  return (
    <div className="space-y-3">
      {entries.length === 0 ? (
        <p className="type-body-secondary text-muted-foreground">Nothing is scheduled in the next two weeks</p>
      ) : (
        <ol className="relative space-y-1">
          {entries.map((entry, index) => {
            const date = localDate(entry.day);
            const sameDayAsPrevious = index > 0 && entries[index - 1]!.day === entry.day;
            return (
              <li key={entry.id}>
                {renderLink({
                  href: entry.href,
                  className: "group grid grid-cols-[72px_20px_minmax(0,1fr)] items-start gap-3 rounded-control py-2 pr-2 transition-colors hover:bg-card",
                  children: (
                    <>
                      <span className="text-right">
                        {!sameDayAsPrevious ? (
                          <span className="block type-label text-foreground">
                            {WEEKDAY.format(date)} {date.getDate()}
                            {date.getMonth() !== (props.today ?? new Date()).getMonth() ? ` ${date.toLocaleString("en-GB", { month: "short" })}` : ""}
                          </span>
                        ) : null}
                        {entry.at ? <span className="block type-meta tabular-nums text-muted-foreground">{TIME.format(new Date(entry.at))}</span> : null}
                      </span>
                      <span className="relative flex h-full justify-center">
                        {index < entries.length - 1 ? (
                          <span aria-hidden className="absolute top-5 bottom-[-12px] w-px bg-border" />
                        ) : null}
                        <span
                          aria-hidden
                          className={cn(
                            "relative mt-1 size-3 rounded-[3px] ring-2 ring-inset",
                            index === 0 ? "bg-primary ring-primary" : entry.due ? "bg-background ring-primary" : "bg-background ring-muted-foreground/50",
                          )}
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate type-label text-foreground">{entry.title}</span>
                        {entry.context ? <span className="block truncate type-meta text-muted-foreground">{entry.context}</span> : null}
                      </span>
                    </>
                  ),
                })}
              </li>
            );
          })}
        </ol>
      )}
      {failed.map((module) => (
        <p key={module.key} role="status" className="type-meta text-muted-foreground">
          {module.label}&apos;s dates couldn&apos;t be loaded
        </p>
      ))}
    </div>
  );
}
