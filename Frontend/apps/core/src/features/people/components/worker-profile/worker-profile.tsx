"use client";

import Link from "next/link";
import type { ReactNode, Ref } from "react";
import { Button, Skeleton, cn } from "@repo/ds";
import { PageContainer, StatusBadge } from "@repo/ds/shell";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  Clock,
  FileText,
  IdCard,
  Lock,
  type LucideIcon,
  Mail,
  MapPin,
  Phone,
  Users,
} from "lucide-react";
import type {
  PeopleChangeFieldDto,
  PeopleTimelineEventDto,
  PeopleUpcomingChangeDto,
} from "@repo/api";
import { Monogram, OrgPath, formatWorkforceDate } from "../workforce-ui";
import { formatEmploymentType, type WorkerProfileView } from "./worker-profile-view";

export interface WorkerProfileProps {
  view: WorkerProfileView;
  /** Small overline above the name — self renders "Profile"; omitted for other workers. */
  eyebrow?: string;
  /** Back navigation rendered above the hero (other-worker returns to People). */
  backLink?: ReactNode;
  /** Right-aligned hero chrome: self "Edit", or as-of control + management actions. */
  headerActions?: ReactNode;
  /** Chip shown beside the name after an establishment reveal (other-worker). */
  nameBadge?: ReactNode;
  /** H1 ref, for focus management after navigation (other-worker establishment). */
  headingRef?: Ref<HTMLHeadingElement>;
  /** Footer under the direct-reports list (self links to the team; other shows "+N more"). */
  reportsFooter?: ReactNode;
  /** Fetch state for the Fusion access section (other-worker loads it separately). */
  accessState?: "loading" | "error" | "ready";
  onRetryAccess?: () => void;
  /** History is fetched separately; show its skeleton while it resolves. */
  timelineLoading?: boolean;
  /** CTA for the access section — manage / set up / add work email. */
  accessAction?: ReactNode;
  /** Trigger to add or edit the canonical work email (other-worker, when permitted). */
  workEmailAction?: ReactNode;
  /** View the worker as of a scheduled change's effective date (other-worker). */
  onViewAsOf?: (isoDate: string) => void;
}

function isoDay(value: string): string {
  return value.length >= 10 ? value.slice(0, 10) : value;
}

export function WorkerProfile({
  view,
  eyebrow,
  backLink,
  headerActions,
  nameBadge,
  headingRef,
  reportsFooter,
  accessState,
  onRetryAccess,
  timelineLoading = false,
  accessAction,
  workEmailAction,
  onViewAsOf,
}: WorkerProfileProps) {
  const {
    manager,
    directReports,
    directReportCount,
    upcoming,
    timeline,
    access,
  } = view;
  const visibleReports = directReports.slice(0, 5);
  const showAccess = accessState === "loading" || accessState === "error" || Boolean(access);
  const showTimeline = timelineLoading || timeline.length > 0;
  const showUpcoming = !view.isAsOf && upcoming.length > 0;

  return (
    <PageContainer width="wide" className="max-w-6xl space-y-6 pb-16">
      {backLink}

      {eyebrow ? (
        <p className="type-eyebrow text-muted-foreground">{eyebrow}</p>
      ) : null}

      {/* Hero — identity, work context, and the facts a worker reaches for first */}
      <section className="relative overflow-hidden rounded-2xl border bg-card p-6 sm:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 h-44 w-80 overflow-hidden"
        >
          <div className="absolute -right-28 -top-32 size-72 rounded-full border border-primary/25" />
          <div className="absolute -right-20 -top-28 size-56 rounded-full bg-primary/10 blur-3xl" />
        </div>

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-x-6">
          <div className="flex min-w-0 items-start gap-5 sm:flex-1">
            <Monogram
              name={view.displayName}
              size="xl"
              accent
              className="size-16 text-xl"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="min-w-0 max-w-full truncate font-[family-name:var(--font-editorial)] text-3xl font-medium leading-[1.15] tracking-[-0.015em] text-foreground outline-none sm:text-4xl"
                >
                  {view.displayName}
                </h1>
                <StatusBadge tone={view.status.tone} dot>
                  {view.status.label}
                </StatusBadge>
                {nameBadge}
              </div>
              {view.jobTitle ? (
                <p className="mt-1.5 type-body text-foreground">{view.jobTitle}</p>
              ) : null}
              {view.orgUnitName ? (
                <p className="mt-1 inline-flex items-center gap-1.5 type-meta text-muted-foreground">
                  <BriefcaseBusiness className="size-3.5" aria-hidden />
                  {view.orgUnitName}
                </p>
              ) : null}
            </div>
          </div>
          {headerActions ? (
            <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
              {headerActions}
            </div>
          ) : null}
        </div>

        <dl className="relative mt-6 grid gap-x-6 gap-y-6 border-t pt-5 sm:grid-cols-2 lg:grid-cols-[1.3fr_0.9fr_0.9fr_1.1fr] lg:gap-x-0 lg:divide-x">
          {view.workEmail ? (
            <HeroFact icon={Mail} label="Work email" value={view.workEmail} />
          ) : null}
          {view.employeeNumber ? (
            <HeroFact
              icon={IdCard}
              label="Worker ID"
              value={view.employeeNumber}
              code
            />
          ) : null}
          {view.workLocation ? (
            <HeroFact icon={MapPin} label="Location" value={view.workLocation} />
          ) : null}
          {manager ? (
            <HeroFact icon={Users} label="Manager">
              <Link
                href={manager.href}
                className="group flex min-w-0 items-center gap-2 underline-offset-4"
              >
                <Monogram name={manager.name} size="sm" />
                <span className="truncate type-body text-foreground group-hover:underline">
                  {manager.name}
                </span>
              </Link>
            </HeroFact>
          ) : null}
        </dl>
      </section>

      {/* Upcoming — delta-first scheduled changes; collapses entirely when empty */}
      {showUpcoming ? (
        <section className="motion-safe:animate-in motion-safe:fade-in">
          <h2 className="type-eyebrow text-muted-foreground">Upcoming</h2>
          <ul className="mt-3.5 grid gap-3 sm:grid-cols-2">
            {upcoming.map((item, index) => (
              <UpcomingCard
                key={`${item.kind}-${item.effectiveDate}-${index}`}
                item={item}
                onView={
                  onViewAsOf
                    ? () => onViewAsOf(isoDay(item.effectiveDate))
                    : undefined
                }
              />
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Left column */}
        <div className="space-y-6">
          <ProfileCard icon={BriefcaseBusiness} title="Current assignment">
            {view.workUnavailable ? (
              <p className="type-body text-muted-foreground">
                Work details unavailable
              </p>
            ) : (
              <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                <CardFact
                  label="Display title"
                  value={view.jobTitle || "Not assigned"}
                  quiet={!view.jobTitle}
                />
                <CardFact label="Organization">
                  {view.orgUnitPath ? (
                    <OrgPath
                      name={view.orgUnitName}
                      path={view.orgUnitPath}
                      unitClassName="type-body text-foreground"
                    />
                  ) : (
                    <span
                      className={cn(
                        "truncate",
                        view.orgUnitName
                          ? "type-body text-foreground"
                          : "type-body text-muted-foreground"
                      )}
                    >
                      {view.orgUnitName || "Not assigned"}
                    </span>
                  )}
                </CardFact>
                <CardFact label="Manager">
                  {manager ? (
                    <Link
                      href={manager.href}
                      className="truncate type-body text-foreground underline-offset-4 hover:underline"
                    >
                      {manager.name}
                    </Link>
                  ) : (
                    <span className="type-body text-muted-foreground">
                      No manager
                    </span>
                  )}
                </CardFact>
                <CardFact
                  label="Effective since"
                  value={
                    formatWorkforceDate(view.assignmentEffectiveFrom, {
                      month: "long",
                    }) || "—"
                  }
                  quiet={!view.assignmentEffectiveFrom}
                />
                <CardFact label="Worker status">
                  <StatusBadge tone={view.status.tone} dot>
                    {view.status.label}
                  </StatusBadge>
                </CardFact>
              </dl>
            )}
          </ProfileCard>

          <ProfileCard icon={Users} title="Organization & reporting">
            <div>
              <p className="type-eyebrow text-muted-foreground">Manager</p>
              {manager ? (
                <Link href={manager.href} className="group mt-2.5 flex items-center gap-3">
                  <Monogram name={manager.name} size="md" />
                  <div className="min-w-0">
                    <p className="truncate type-label font-semibold text-foreground group-hover:underline">
                      {manager.name}
                    </p>
                    {manager.email ? (
                      <p className="truncate type-meta text-muted-foreground">
                        {manager.email}
                      </p>
                    ) : manager.employeeNumber ? (
                      <p className="truncate type-code text-xs text-muted-foreground">
                        {manager.employeeNumber}
                      </p>
                    ) : null}
                  </div>
                </Link>
              ) : (
                <p className="mt-2 type-body text-muted-foreground">
                  No manager assigned
                </p>
              )}
            </div>

            {directReportCount > 0 ? (
              <div className="mt-5 border-t pt-5">
                <p className="type-eyebrow text-muted-foreground">
                  Direct reports ·{" "}
                  {directReportCount > visibleReports.length
                    ? `${visibleReports.length} of ${directReportCount}`
                    : directReportCount}
                </p>
                <ul className="mt-3 space-y-3.5">
                  {visibleReports.map((report) => (
                    <li key={report.href}>
                      <Link href={report.href} className="group flex items-center gap-3">
                        <Monogram name={report.name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate type-label font-medium text-foreground group-hover:underline">
                            {report.name}
                          </p>
                          {report.jobTitle ? (
                            <p className="truncate type-meta text-muted-foreground">
                              {report.jobTitle}
                            </p>
                          ) : null}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
                {reportsFooter ??
                  (directReportCount > visibleReports.length ? (
                    <p className="mt-3 type-meta text-muted-foreground">
                      +{directReportCount - visibleReports.length} more
                    </p>
                  ) : null)}
              </div>
            ) : null}
          </ProfileCard>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <ProfileCard icon={FileText} title="Employment">
            <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <CardFact
                icon={CalendarDays}
                label="Employment period"
                value={view.employmentLine || "—"}
                quiet={!view.employmentLine}
              />
              <CardFact
                label="Worker type"
                value={formatEmploymentType(view.employmentType)}
                quiet={!view.employmentType}
              />
            </dl>
          </ProfileCard>

          {showAccess ? (
            <ProfileCard icon={Lock} title="Fusion access">
              {accessState === "loading" ? (
                <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : accessState === "error" ? (
                <div>
                  <p className="type-body font-medium text-foreground">
                    Status unavailable
                  </p>
                  {onRetryAccess ? (
                    <Button
                      variant="link"
                      className="mt-1 h-auto p-0 type-meta"
                      onClick={onRetryAccess}
                    >
                      Retry
                    </Button>
                  ) : null}
                </div>
              ) : access ? (
                isRichAccess(access) ? (
                  <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                    <CardFact label="Account status">
                      <StatusBadge tone={access.tone} dot>
                        {access.label}
                      </StatusBadge>
                    </CardFact>
                    <CardFact
                      label="Linked account"
                      value={access.linkedEmail || "—"}
                      quiet={!access.linkedEmail}
                    />
                    <CardFact
                      label="Access profile"
                      value={
                        access.accessProfiles && access.accessProfiles.length > 0
                          ? access.accessProfiles.join(", ")
                          : "—"
                      }
                      quiet={
                        !access.accessProfiles ||
                        access.accessProfiles.length === 0
                      }
                    />
                    <CardFact
                      label="Last sign-in"
                      value={
                        formatWorkforceDate(access.lastSignInAt, {
                          month: "short",
                        }) || "—"
                      }
                      quiet={!access.lastSignInAt}
                    />
                  </dl>
                ) : (
                  <div>
                    <p className="type-body font-medium text-foreground">
                      {access.label}
                    </p>
                    {access.detail ? (
                      <p className="truncate type-meta text-muted-foreground">
                        {access.detail}
                      </p>
                    ) : null}
                    {accessAction ? <div className="mt-1.5">{accessAction}</div> : null}
                  </div>
                )
              ) : null}
            </ProfileCard>
          ) : null}

          <ProfileCard icon={Mail} title="Work contact">
            <dl className="grid gap-x-5 gap-y-5 sm:grid-cols-[1.9fr_1fr_1fr]">
              <div className="min-w-0">
                <CardFact
                  icon={Mail}
                  label="Work email"
                  value={view.workEmail || "Not set"}
                  quiet={!view.workEmail}
                />
                {!view.workEmail ? (
                  <p className="mt-1 type-meta text-muted-foreground">
                    Required before Fusion access can be set up.
                  </p>
                ) : null}
                {workEmailAction ? (
                  <div className="mt-1.5">{workEmailAction}</div>
                ) : null}
              </div>
              <CardFact
                icon={Phone}
                label="Work phone"
                value={view.phone || "Not set"}
                quiet={!view.phone}
              />
              <CardFact
                icon={MapPin}
                label="Location"
                value={view.workLocation || "Not set"}
                quiet={!view.workLocation}
              />
            </dl>
          </ProfileCard>

          {showTimeline ? (
            <ProfileCard icon={Clock} title="History">
              {timelineLoading && timeline.length === 0 ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-2/3" />
                </div>
              ) : (
                <ProfileTimeline events={timeline} />
              )}
            </ProfileCard>
          ) : null}
        </div>
      </div>
    </PageContainer>
  );
}

function isRichAccess(access: WorkerProfileView["access"]): boolean {
  if (!access) return false;
  return (
    access.linkedEmail != null ||
    access.lastSignInAt != null ||
    (access.accessProfiles?.length ?? 0) > 0
  );
}

function ProfileCard({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: LucideIcon;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <header className="flex items-center justify-between gap-4 border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-object bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
            <Icon className="size-[1.05rem]" aria-hidden />
          </span>
          <h2 className="type-panel-title text-foreground">{title}</h2>
        </div>
        {action}
      </header>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

function HeroFact({
  icon: Icon,
  label,
  value,
  code = false,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value?: string;
  code?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 lg:px-6 lg:first:pl-0 lg:last:pr-0">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground/80">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <dt className="type-eyebrow text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 min-w-0">
          {children ?? (
            <span
              className={cn(
                "block truncate",
                code ? "type-code text-sm text-foreground" : "type-body text-foreground"
              )}
            >
              {value}
            </span>
          )}
        </dd>
      </div>
    </div>
  );
}

function CardFact({
  icon: Icon,
  label,
  value,
  quiet = false,
  code = false,
  children,
}: {
  icon?: LucideIcon;
  label: string;
  value?: string;
  quiet?: boolean;
  code?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="type-meta text-muted-foreground">{label}</dt>
      <dd className="mt-1 flex min-w-0 items-center gap-2">
        {Icon ? (
          <Icon className="size-4 shrink-0 text-muted-foreground/70" aria-hidden />
        ) : null}
        {children ?? (
          <span
            className={cn(
              "truncate",
              quiet
                ? "type-body text-muted-foreground"
                : code
                  ? "type-code text-sm text-foreground"
                  : "type-body text-foreground"
            )}
          >
            {value}
          </span>
        )}
      </dd>
    </div>
  );
}

/** from → to for a single changed field; a single value renders alone. */
function ChangeField({ field }: { field: PeopleChangeFieldDto }) {
  return (
    <p className="type-meta">
      <span className="text-muted-foreground">{field.label} </span>
      {field.from ? (
        <>
          <span className="text-muted-foreground line-through decoration-muted-foreground/40">
            {field.from}
          </span>
          <ArrowRight
            aria-hidden
            className="mx-1.5 inline size-3.5 -translate-y-px text-muted-foreground"
          />
        </>
      ) : null}
      <span className="font-medium text-foreground">{field.to ?? "—"}</span>
    </p>
  );
}

function UpcomingCard({
  item,
  onView,
}: {
  item: PeopleUpcomingChangeDto;
  onView?: () => void;
}) {
  const kindLabel = item.kind === "Work" ? "Work change" : "Manager change";
  return (
    <li className="group flex flex-col justify-between gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/30 motion-reduce:transition-none">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 type-meta font-medium tabular-nums text-primary">
            {formatWorkforceDate(item.effectiveDate)}
          </span>
          <span className="type-label">{kindLabel}</span>
        </div>
        <div className="mt-2 space-y-0.5">
          {item.fields.map((field) => (
            <ChangeField key={field.label} field={field} />
          ))}
        </div>
      </div>
      {onView ? (
        <Button
          size="sm"
          variant="ghost"
          className="-ml-2 self-start text-muted-foreground group-hover:text-foreground"
          onClick={onView}
        >
          View as of {formatWorkforceDate(item.effectiveDate)}
          <ChevronRight className="size-4" />
        </Button>
      ) : null}
    </li>
  );
}

function ProfileTimeline({ events }: { events: PeopleTimelineEventDto[] }) {
  if (events.length === 0) {
    return (
      <p className="type-body text-muted-foreground">No employment history yet.</p>
    );
  }
  // Oldest first: the timeline reads as a life-of-record story top to bottom.
  const ordered = [...events].sort((a, b) =>
    a.effectiveDate.localeCompare(b.effectiveDate)
  );
  const last = ordered.length - 1;
  return (
    <ol>
      {ordered.map((event, index) => (
        <li
          key={`${event.kind}-${event.effectiveDate}-${index}`}
          className="flex gap-4"
        >
          <span
            className={cn(
              "w-[5.5rem] shrink-0 pt-0.5 text-right type-meta tabular-nums",
              event.isFuture ? "text-primary" : "text-muted-foreground"
            )}
          >
            {formatWorkforceDate(event.effectiveDate)}
          </span>
          <div className="flex flex-col items-center" aria-hidden>
            <span
              className={cn(
                "mt-1 size-2.5 shrink-0 rounded-full ring-4",
                event.isFuture
                  ? "bg-primary ring-primary/15"
                  : "bg-muted-foreground/35 ring-transparent"
              )}
            />
            {index < last ? <span className="w-px flex-1 bg-border" /> : null}
          </div>
          <div className={cn("min-w-0", index < last && "pb-6")}>
            <p className="type-label text-foreground">{event.title}</p>
            {event.fields.length > 0 ? (
              <div className="mt-1 space-y-0.5">
                {event.fields.map((field) => (
                  <ChangeField key={field.label} field={field} />
                ))}
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
