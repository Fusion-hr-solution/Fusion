import type { OverviewYearDto, YearDateDto } from "@repo/api";
import { daysFromToday, formatDate, formatDateRange } from "@repo/ds/lib/dates";

/**
 * Overview is one server projection (performance-overview): the year, then rows in a fixed order, each with its
 * facts and the exact place it resumes. What remains here is wording and turning server paths into this app's routes.
 */
const BASE = "/performance";

/** A server path ("/performance/reviews/1") as a route inside this app ("/reviews/1"). */
export function appHref(href: string): string {
  return href === BASE ? "/" : href.startsWith(`${BASE}/`) || href.startsWith(`${BASE}?`) ? href.slice(BASE.length) : href;
}

export const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** "Sat 31 Oct" (the year outside this year). */
export function day(iso: string): string {
  return formatDate(iso.slice(0, 10), { weekday: true });
}

/** "1 Oct – 31 Oct". */
export function dayRange(start: string, end: string): string {
  return formatDateRange(start, end, { omitYear: true });
}

/** Whole days from today to an ISO date or instant (negative once past). */
export function daysFrom(iso: string, now: Date = new Date()): number {
  return daysFromToday(iso.slice(0, 10), now) ?? 0;
}

/** "today", "yesterday", "6 days ago". */
export function ago(iso: string, now: Date = new Date()): string {
  const days = -daysFrom(iso, now);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

export const firstName = (name: string | null | undefined) => name?.trim().split(/\s+/)[0] ?? "";

const DATE_LABEL: Record<YearDateDto["kind"], string> = {
  "plans-due": "Plans due",
  "self-due": "Self-assessment due",
  "peers-due": "Peer input due",
  "reviews-due": "Your reviews are due",
  "managers-due": "Manager reviews due",
  "cycle-end": "Year ends",
  "cycle-start": "Planned start",
};

/** The year band's heading: the phase and what's left of it, and the next date in words. */
export function yearHeadline(year: OverviewYearDto, cycleName: string): { phase: string; left: string | null; next: string | null } {
  if (year.state === "Closed") {
    return { phase: `${cycleName} is closed`, left: null, next: year.closedAt ? `Closed ${day(year.closedAt)}` : null };
  }
  if (year.state === "Draft") {
    const planning = year.dates.find((d) => d.kind === "plans-due");
    return {
      phase: "Draft",
      left: null,
      next: `Planned start ${day(year.start)}${planning ? ` · planning by ${day(planning.date)}` : ""}`,
    };
  }
  // A manager-review date that has passed with reviews still late is the administrator's news.
  const lateManagers = year.dates.find((d) => d.kind === "managers-due" && daysFrom(d.date) < 0 && (d.count ?? 0) > 0);
  const next = lateManagers
    ? `Manager reviews were due ${day(lateManagers.date)} · ${lateManagers.count} late`
    : year.next
      ? `${DATE_LABEL[year.next.kind]} ${day(year.next.date)}`
      : null;
  const left = year.daysLeft === null ? null : year.daysLeft === 0 ? "today" : plural(year.daysLeft, "day") + " left";
  return { phase: year.currentPhase ?? "", left, next };
}

/** Plan state words for chips and rows. */
export const PLAN_WORD: Record<string, string> = {
  NotStarted: "Not started",
  Draft: "Drafting",
  ReturnedForChanges: "Returned",
  Submitted: "Submitted",
  Approved: "Approved",
};

/** Review stage words for the reviews-you-write chips. */
export const REVIEW_CHIP: Record<string, string> = {
  ready: "Ready",
  readyPeers: "Ready · peers to approve",
  peersToApprove: "Peers to approve",
  selfAssessment: "Writing their own",
  submitted: "Submitted",
};
