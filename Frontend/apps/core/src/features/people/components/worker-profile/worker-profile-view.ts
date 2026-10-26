import type { StatusTone } from "@repo/ds/shell";
import type {
  PeopleAccessStatusDto,
  PeopleProfileDto,
  PeopleProfileEmploymentDto,
  PeopleTimelineDto,
  PeopleTimelineEventDto,
  PeopleUpcomingChangeDto,
} from "@repo/api";
import { englishSay, type Say } from "@repo/ds/lib/say";
import { englishMessages } from "@/i18n/messages";
import { formatWorkforceDate } from "../workforce-ui";
import type {
  EmployeeDetailsDto,
  EmployeeReportingLinesDto,
  MyFusionAccessDto,
} from "@/app/(pages)/employees/employee-roster.types";

/**
 * The canonical worker-profile view model.
 *
 * One shape both entry points normalize into so a single presentational surface
 * (`WorkerProfile`) renders the current worker regardless of whether the viewer
 * is looking at their own record (`/core/profile`) or another person's
 * (`/core/people/{employeeKey}`). Business data comes from Core workforce truth;
 * the viewer's capabilities and relationship to the subject are expressed by the
 * container through the surface's slots, never baked into this model.
 */
export interface WorkerProfileManager {
  name: string;
  /** Root-relative profile href (basePath `/core` is applied by Next). */
  href: string;
  email?: string | null;
  employeeNumber?: string | null;
}

export interface WorkerProfileReport {
  name: string;
  href: string;
  jobTitle?: string | null;
}

export interface WorkerProfileAccess {
  label: string;
  tone: StatusTone;
  /** People projection: one authoritative detail line. */
  detail?: string | null;
  /** Self projection: the richer account facts. */
  linkedEmail?: string | null;
  accessProfiles?: string[];
  lastSignInAt?: string | null;
}

export interface WorkerProfileView {
  displayName: string;
  employeeNumber: string | null;
  status: { label: string; tone: StatusTone };

  jobTitle: string | null;
  orgUnitName: string | null;
  /** Full org path (People has ancestry; self has only the unit name). */
  orgUnitPath: string | null;
  workLocation: string | null;
  assignmentEffectiveFrom: string | null;
  /** Work details genuinely unavailable on this date — never invented. */
  workUnavailable: boolean;

  employmentType: string | null;
  employmentStart: string | null;
  /** Human employment line ("Since …" / "Starts …" / "Ended …"); People only. */
  employmentLine: string | null;

  workEmail: string | null;
  phone: string | null;

  manager: WorkerProfileManager | null;
  directReports: WorkerProfileReport[];
  directReportCount: number;

  access: WorkerProfileAccess | null;

  timeline: PeopleTimelineEventDto[];
  upcoming: PeopleUpcomingChangeDto[];

  /** Viewing a non-Today snapshot (People temporal); the snapshot is read-only. */
  isAsOf: boolean;
  viewedDate: string | null;
}

/** Shared tone mapping for Fusion account/access states. */
export const ACCESS_TONE: Record<string, StatusTone> = {
  Active: "success",
  Suspended: "warning",
  NeedsReview: "warning",
  InvitationPending: "info",
  NoAccess: "muted",
};

/** How the view model words things: the `profile` namespace and the language for dates. English by default. */
export interface ProfileWords {
  say: Say;
  locale?: string;
}

const ENGLISH: ProfileWords = { say: englishSay(englishMessages, "profile") };

const EMPLOYMENT_TYPES = new Set(["FullTime", "PartTime", "Contract", "Contractor", "Intern", "Temporary", "Seasonal"]);

/** Humanize an employment-type enum for display; passes through already-humanized values. */
export function formatEmploymentType(value: string | null | undefined, words: ProfileWords = ENGLISH): string {
  if (!value) return words.say("employmentType.notSet");
  return EMPLOYMENT_TYPES.has(value)
    ? words.say(`employmentType.${value}`)
    : value.replace(/([a-z])([A-Z])/g, "$1 $2");
}

/** A Fusion access state in words; an unknown state keeps the server's label. */
function accessLabel(state: string, label: string, say: Say): string {
  return state in ACCESS_TONE ? say(`access.${state}`) : label;
}

/** The People employment state expressed as a plain human line. */
function employmentLine(employment: PeopleProfileEmploymentDto, { say, locale }: ProfileWords): string {
  const { state, start, end } = employment;
  const long = (value: string) => formatWorkforceDate(value, { month: "long", locale });
  if (state === "Scheduled")
    return start ? say("line.starts", { date: long(start) }) : say("line.startsLater");
  if (state === "Former") {
    if (start && end) return say("line.period", { start: long(start), end: long(end) });
    return end ? say("line.ended", { date: long(end) }) : say("line.employmentEnded");
  }
  if (state === "Incomplete") return say("line.notEmployed");
  return start ? say("line.since", { date: long(start) }) : say("line.active");
}

const PEOPLE_STATE_TONE: Record<string, StatusTone> = {
  Active: "success",
  Scheduled: "info",
  Former: "muted",
  Incomplete: "warning",
};

/**
 * Normalize the authenticated worker's own Core record into the shared view.
 * Self stays a clean current-state view — no as-of/upcoming temporal machinery.
 */
export function fromSelfDetails(
  details: EmployeeDetailsDto,
  reportingLines: EmployeeReportingLinesDto | undefined,
  context: { timeline?: PeopleTimelineDto; access?: MyFusionAccessDto | null },
  words: ProfileWords = ENGLISH
): WorkerProfileView {
  const { say, locale } = words;
  const long = (value: string) => formatWorkforceDate(value, { month: "long", locale });
  const assignment = details.currentWorkAssignment;
  const employment = details.currentEmployment;
  const manager = details.currentManager;
  const active = employment?.status !== "Ended";
  const reports = reportingLines?.directReports ?? [];
  const access = context.access ?? null;

  const selfEmploymentLine = employment
    ? employment.status === "Ended"
      ? employment.effectiveTo
        ? say("line.ended", { date: long(employment.effectiveTo) })
        : say("line.employmentEnded")
      : employment.effectiveFrom
        ? say("line.since", { date: long(employment.effectiveFrom) })
        : say("line.active")
    : null;

  return {
    displayName: details.displayName,
    employeeNumber: details.employeeNumber ?? null,
    status: active
      ? { label: say("status.Active"), tone: "success" }
      : { label: say("status.Ended"), tone: "muted" },

    jobTitle: assignment?.jobTitle ?? null,
    orgUnitName: assignment?.orgUnitName ?? null,
    orgUnitPath: null,
    workLocation: assignment?.workLocation ?? null,
    assignmentEffectiveFrom: assignment?.effectiveFrom ?? null,
    workUnavailable: !assignment,

    employmentType: employment?.employmentType ?? null,
    employmentStart: employment?.effectiveFrom ?? null,
    employmentLine: selfEmploymentLine,

    workEmail: details.email,
    phone: details.phone,

    manager: manager
      ? {
          name: manager.managerFullName,
          // The People profile route resolves by stable employee key, not the uuid.
          href: `/people/${manager.managerStableEmployeeKey}`,
          email: manager.managerEmail,
        }
      : null,
    directReports: reports.map(({ employee }) => ({
      name:
        employee.displayName ||
        employee.fullName ||
        `${employee.firstName} ${employee.lastName}`,
      href: `/people/${employee.stableEmployeeKey}`,
      jobTitle: employee.jobTitle,
    })),
    directReportCount: reports.length,

    access: access
      ? {
          label: accessLabel(access.state, access.label, say),
          tone: ACCESS_TONE[access.state] ?? "muted",
          linkedEmail: access.linkedEmail ?? details.email,
          accessProfiles: access.accessProfiles,
          lastSignInAt: access.lastSignInAt,
        }
      : null,

    timeline: context.timeline?.timeline ?? [],
    upcoming: [],

    isAsOf: false,
    viewedDate: null,
  };
}

/**
 * Normalize another worker's temporal People snapshot into the shared view.
 * Carries the as-of/upcoming machinery and org ancestry the People read owns.
 */
export function fromPeopleProfile(
  profile: PeopleProfileDto,
  timeline: PeopleTimelineEventDto[] | undefined,
  access: PeopleAccessStatusDto | null,
  words: ProfileWords = ENGLISH
): WorkerProfileView {
  const { identity, employment, work, primaryManager } = profile;
  const { say } = words;

  return {
    displayName: identity.displayName,
    employeeNumber: identity.employeeNumber,
    status: {
      label: employment.state in PEOPLE_STATE_TONE ? say(`status.${employment.state}`) : employment.state,
      tone: PEOPLE_STATE_TONE[employment.state] ?? "muted",
    },

    jobTitle: work?.jobTitle ?? null,
    orgUnitName: work?.organizationName ?? null,
    orgUnitPath: work?.organizationPath ?? null,
    workLocation: work?.location ?? null,
    assignmentEffectiveFrom: work?.effectiveFrom ?? null,
    workUnavailable: !work,

    employmentType: employment.employmentType,
    employmentStart: employment.start,
    employmentLine: employmentLine(employment, words),

    workEmail: identity.workEmail,
    phone: identity.phone,

    manager: primaryManager
      ? {
          name: primaryManager.displayName,
          href: `/people/${primaryManager.employeeKey}`,
          employeeNumber: primaryManager.employeeNumber,
        }
      : null,
    directReports: profile.directReports.map((report) => ({
      name: report.displayName,
      href: `/people/${report.employeeKey}`,
      jobTitle: report.jobTitle,
    })),
    directReportCount: profile.directReportCount,

    access: access
      ? {
          label: accessLabel(access.state, access.label, say),
          tone: ACCESS_TONE[access.state] ?? "muted",
          detail: access.detail,
        }
      : null,

    timeline: timeline ?? [],
    upcoming: profile.upcoming,

    isAsOf: profile.isAsOf,
    viewedDate: profile.viewedDate,
  };
}
