import type { OverviewYearDto } from "@repo/api";
import { daysFromToday, formatDate, formatDateRange } from "@repo/ds/lib/dates";
import { english, type Say } from "@/i18n/say";

/**
 * Overview is one server projection (performance-overview): the year, then rows in a fixed order, each with its
 * facts and the exact place it resumes. What remains here is wording and turning server paths into this app's routes.
 */
const BASE = "/performance";

/** A server path ("/performance/reviews/1") as a route inside this app ("/reviews/1"). */
export function appHref(href: string): string {
  return href === BASE ? "/" : href.startsWith(`${BASE}/`) || href.startsWith(`${BASE}?`) ? href.slice(BASE.length) : href;
}

/** Overview's own words in English, for helpers called outside a translated tree. */
const en = english("overview.model");

/** "Sat 31 Oct" (the year outside this year). */
export function day(iso: string, locale?: string): string {
  return formatDate(iso.slice(0, 10), { weekday: true, locale });
}

/** "1 Oct – 31 Oct". */
export function dayRange(start: string, end: string, locale?: string): string {
  return formatDateRange(start, end, { omitYear: true, locale });
}

/** Whole days from today to an ISO date or instant (negative once past). */
export function daysFrom(iso: string, now: Date = new Date()): number {
  return daysFromToday(iso.slice(0, 10), now) ?? 0;
}

/** "today", "yesterday", "6 days ago". */
export function ago(iso: string, now: Date = new Date(), say: Say = en): string {
  const days = -daysFrom(iso, now);
  return days <= 0 ? say("today") : days === 1 ? say("yesterday") : say("daysAgo", { count: days });
}

export const firstName = (name: string | null | undefined) => name?.trim().split(/\s+/)[0] ?? "";


/** The year band's heading: the phase and what's left of it, and the next date in words. */
export function yearHeadline(year: OverviewYearDto, cycleName: string, say: Say = en, locale?: string): { phase: string; left: string | null; next: string | null } {
  const day_ = (iso: string) => day(iso, locale);
  if (year.state === "Closed") {
    return { phase: say("closedPhase", { cycleName }), left: null, next: year.closedAt ? say("closedOn", { day: day_(year.closedAt) }) : null };
  }
  if (year.state === "Draft") {
    const planning = year.dates.find((d) => d.kind === "plans-due");
    return {
      phase: say("draft"),
      left: null,
      next: planning ? say("plannedStartPlanning", { day: day_(year.start), planning: day_(planning.date) }) : say("plannedStart", { day: day_(year.start) }),
    };
  }
  // A manager-review date that has passed with reviews still late is the administrator's news.
  const lateManagers = year.dates.find((d) => d.kind === "managers-due" && daysFrom(d.date) < 0 && (d.count ?? 0) > 0);
  const next = lateManagers
    ? say("managersLate", { day: day_(lateManagers.date), count: lateManagers.count ?? 0 })
    : year.next
      ? say("nextDate", { label: say(`date.${year.next.kind}`), day: day_(year.next.date) })
      : null;
  const left = year.daysLeft === null ? null : year.daysLeft === 0 ? say("leftToday") : say("daysLeft", { count: year.daysLeft });
  return { phase: year.currentPhase ? say(`phase.${year.currentPhase}`) : "", left, next };
}

const PLAN_STATES = ["NotStarted", "Draft", "ReturnedForChanges", "Submitted", "Approved"];
const REVIEW_STAGES = ["ready", "readyPeers", "peersToApprove", "selfAssessment", "submitted"];

/** A plan state's word for chips and rows; an unknown one as sent. */
export function planWord(state: string, say: Say = en): string {
  return PLAN_STATES.includes(state) ? say(`plan.${state}`) : state;
}

/** A review stage's word for the reviews-you-write chips; an unknown one as sent. */
export function reviewChip(stage: string, say: Say = en): string {
  return REVIEW_STAGES.includes(stage) ? say(`review.${stage}`) : stage;
}
