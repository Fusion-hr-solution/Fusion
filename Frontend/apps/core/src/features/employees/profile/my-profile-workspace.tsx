"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Skeleton,
  cn,
} from "@repo/ds";
import { PageContainer, StatusBadge, type StatusTone } from "@repo/ds/shell";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Clock,
  FileText,
  IdCard,
  type LucideIcon,
  Lock,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type {
  PeopleChangeFieldDto,
  PeopleTimelineDto,
  PeopleTimelineEventDto,
} from "@repo/api";
import { Monogram, formatWorkforceDate } from "@/features/people/components/workforce-ui";
import { useUpdateMyProfile } from "@/app/(pages)/employees/use-employees";
import type {
  EmployeeDetailsDto,
  EmployeeReportingLinesDto,
  MyFusionAccessDto,
} from "@/app/(pages)/employees/employee-roster.types";

const ACCESS_TONE: Record<string, StatusTone> = {
  Active: "success",
  Suspended: "warning",
  NeedsReview: "warning",
  InvitationPending: "info",
  NoAccess: "muted",
};

export function MyProfileWorkspace({
  details,
  reportingLines,
  timeline,
  access,
  isContextLoading = false,
  canEditPreferredName,
  canEditPhone,
}: {
  details: EmployeeDetailsDto;
  reportingLines?: EmployeeReportingLinesDto;
  timeline?: PeopleTimelineDto;
  access?: MyFusionAccessDto | null;
  isContextLoading?: boolean;
  canEditPreferredName: boolean;
  canEditPhone: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const assignment = details.currentWorkAssignment;
  const employment = details.currentEmployment;
  const manager = details.currentManager;
  const directReports = reportingLines?.directReports ?? [];
  const totalReports = directReports.length;
  const visibleReports = directReports.slice(0, 5);
  const canEdit = canEditPreferredName || canEditPhone;

  const active = employment?.status !== "Ended";
  const statusTone: StatusTone = active ? "success" : "muted";
  const statusLabel = active ? "Active" : "Ended";

  const historyEvents = timeline?.timeline ?? [];
  const showAccess = isContextLoading || Boolean(access);
  const showHistory = isContextLoading || historyEvents.length > 0;

  return (
    <PageContainer width="wide" className="max-w-6xl space-y-6 pb-16">
      <div>
        <h1 className="type-display text-foreground">Profile</h1>
        <p className="mt-1 type-body text-muted-foreground">
          Worker record and employment context
        </p>
      </div>

      {/* Hero — identity, work context, and the facts a worker reaches for first */}
      <section className="relative overflow-hidden rounded-2xl border bg-card p-6 sm:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 h-44 w-80 overflow-hidden"
        >
          <div className="absolute -right-28 -top-32 size-72 rounded-full border border-primary/25" />
          <div className="absolute -right-20 -top-28 size-56 rounded-full bg-primary/10 blur-3xl" />
        </div>
        {canEdit ? (
          <Button
            variant="outline"
            onClick={() => setEditing(true)}
            className="absolute right-5 top-5 z-10"
          >
            <Pencil className="size-4" aria-hidden /> Edit details
          </Button>
        ) : null}
        <div className="relative flex flex-wrap items-start gap-5">
          <Monogram
            name={details.displayName}
            size="xl"
            accent
            className="size-16 text-xl"
          />
          <div className="min-w-0 flex-1 pr-28 sm:pr-32">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h2 className="truncate font-[family-name:var(--font-editorial)] text-3xl font-medium leading-[1.15] tracking-[-0.015em] text-foreground sm:text-4xl">
                {details.displayName}
              </h2>
              <StatusBadge tone={statusTone} dot>
                {statusLabel}
              </StatusBadge>
            </div>
            {assignment?.jobTitle ? (
              <p className="mt-1.5 type-body text-foreground">
                {assignment.jobTitle}
              </p>
            ) : null}
            {assignment?.orgUnitName ? (
              <p className="mt-1 inline-flex items-center gap-1.5 type-meta text-muted-foreground">
                <BriefcaseBusiness className="size-3.5" aria-hidden />
                {assignment.orgUnitName}
              </p>
            ) : null}
          </div>
        </div>

        <dl className="relative mt-6 grid gap-x-6 gap-y-6 border-t pt-5 sm:grid-cols-2 lg:grid-cols-[1.3fr_0.9fr_0.9fr_1.1fr] lg:gap-x-0 lg:divide-x">
          <HeroFact icon={Mail} label="Work email" value={details.email} />
          {details.employeeNumber ? (
            <HeroFact
              icon={IdCard}
              label="Worker ID"
              value={details.employeeNumber}
              code
            />
          ) : null}
          {assignment?.workLocation ? (
            <HeroFact
              icon={MapPin}
              label="Location"
              value={assignment.workLocation}
            />
          ) : null}
          {manager ? (
            <HeroFact icon={Users} label="Manager">
              <Link
                href={`/core/people/${manager.managerEmployeeId}`}
                className="group flex min-w-0 items-center gap-2 underline-offset-4"
              >
                <Monogram name={manager.managerFullName} size="sm" />
                <span className="truncate type-body text-foreground group-hover:underline">
                  {manager.managerFullName}
                </span>
              </Link>
            </HeroFact>
          ) : null}
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Left column */}
        <div className="space-y-6">
          <ProfileCard icon={BriefcaseBusiness} title="Current assignment">
            <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <CardFact
                label="Display title"
                value={assignment?.jobTitle || "Not assigned"}
                quiet={!assignment?.jobTitle}
              />
              <CardFact
                label="Organization"
                value={assignment?.orgUnitName || "Not assigned"}
                quiet={!assignment?.orgUnitName}
              />
              <CardFact label="Manager">
                {manager ? (
                  <span className="truncate type-body text-foreground">
                    {manager.managerFullName}
                  </span>
                ) : (
                  <span className="type-body text-muted-foreground">
                    No manager
                  </span>
                )}
              </CardFact>
              <CardFact
                label="Effective since"
                value={
                  formatWorkforceDate(assignment?.effectiveFrom, {
                    month: "long",
                  }) || "—"
                }
                quiet={!assignment?.effectiveFrom}
              />
              <CardFact label="Worker status">
                <StatusBadge tone={statusTone} dot>
                  {statusLabel}
                </StatusBadge>
              </CardFact>
            </dl>
          </ProfileCard>

          <ProfileCard
            icon={Users}
            title="Organization & reporting"
            action={
              <Button asChild variant="link" size="sm" className="h-auto p-0">
                <Link href="/core/org-chart">
                  View in organization
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </Button>
            }
          >
            <div>
              <p className="type-eyebrow text-muted-foreground">Manager</p>
              {manager ? (
                <Link
                  href={`/core/people/${manager.managerEmployeeId}`}
                  className="group mt-2.5 flex items-center gap-3"
                >
                  <Monogram name={manager.managerFullName} size="md" />
                  <div className="min-w-0">
                    <p className="truncate type-label font-semibold text-foreground group-hover:underline">
                      {manager.managerFullName}
                    </p>
                    {manager.managerEmail ? (
                      <p className="truncate type-meta text-muted-foreground">
                        {manager.managerEmail}
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

            {totalReports > 0 ? (
              <div className="mt-5 border-t pt-5">
                <p className="type-eyebrow text-muted-foreground">
                  Direct reports ·{" "}
                  {totalReports > visibleReports.length
                    ? `${visibleReports.length} of ${totalReports}`
                    : totalReports}
                </p>
                <ul className="mt-3 space-y-3.5">
                  {visibleReports.map(({ employee }) => {
                    const name =
                      employee.displayName ||
                      employee.fullName ||
                      `${employee.firstName} ${employee.lastName}`;
                    return (
                      <li key={employee.id}>
                        <Link
                          href={`/core/people/${employee.id}`}
                          className="group flex items-center gap-3"
                        >
                          <Monogram name={name} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate type-label font-medium text-foreground group-hover:underline">
                              {name}
                            </p>
                            {employee.jobTitle ? (
                              <p className="truncate type-meta text-muted-foreground">
                                {employee.jobTitle}
                              </p>
                            ) : null}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {totalReports > visibleReports.length ? (
                  <Button
                    asChild
                    variant="link"
                    size="sm"
                    className="mt-3 h-auto p-0"
                  >
                    <Link href="/core/team">
                      View all {totalReports} reports
                      <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                  </Button>
                ) : null}
              </div>
            ) : null}
          </ProfileCard>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <ProfileCard icon={FileText} title="Employment">
            <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-3">
              <CardFact
                label="Worker type"
                value={formatEmploymentType(employment?.employmentType)}
                quiet={!employment?.employmentType}
              />
              <CardFact
                icon={CalendarDays}
                label="Employment start date"
                value={
                  formatWorkforceDate(employment?.effectiveFrom, {
                    month: "short",
                  }) || "—"
                }
                quiet={!employment?.effectiveFrom}
              />
              <CardFact
                icon={CalendarDays}
                label="Assignment effective date"
                value={
                  formatWorkforceDate(assignment?.effectiveFrom, {
                    month: "short",
                  }) || "—"
                }
                quiet={!assignment?.effectiveFrom}
              />
            </dl>
          </ProfileCard>

          {showAccess ? (
            <ProfileCard icon={Lock} title="Fusion access">
              {isContextLoading && !access ? (
                <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : access ? (
                <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                  <CardFact label="Account status">
                    <StatusBadge
                      tone={ACCESS_TONE[access.state] ?? "muted"}
                      dot
                    >
                      {access.label}
                    </StatusBadge>
                  </CardFact>
                  <CardFact
                    label="Linked account"
                    value={access.linkedEmail || details.email}
                  />
                  <CardFact
                    label="Access profile"
                    value={
                      access.accessProfiles.length > 0
                        ? access.accessProfiles.join(", ")
                        : "—"
                    }
                    quiet={access.accessProfiles.length === 0}
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
              ) : null}
            </ProfileCard>
          ) : null}

          <ProfileCard icon={Mail} title="Work contact">
            <dl className="grid gap-x-5 gap-y-5 sm:grid-cols-[1.9fr_1fr_1fr]">
              <CardFact icon={Mail} label="Work email" value={details.email} />
              <CardFact
                icon={Phone}
                label="Work phone"
                value={details.phone || "Not set"}
                quiet={!details.phone}
              />
              <CardFact
                icon={MapPin}
                label="Location"
                value={assignment?.workLocation || "Not set"}
                quiet={!assignment?.workLocation}
              />
            </dl>
          </ProfileCard>

          {showHistory ? (
            <ProfileCard icon={Clock} title="Employment timeline">
              {isContextLoading && historyEvents.length === 0 ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-2/3" />
                </div>
              ) : (
                <ProfileTimeline events={historyEvents} />
              )}
            </ProfileCard>
          ) : null}
        </div>
      </div>

      {editing ? (
        <EditMyDetailsDialog
          open
          onOpenChange={setEditing}
          details={details}
          canEditPreferredName={canEditPreferredName}
          canEditPhone={canEditPhone}
        />
      ) : null}
    </PageContainer>
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
          <h3 className="type-panel-title text-foreground">{title}</h3>
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
                code
                  ? "type-code text-sm text-foreground"
                  : "type-body text-foreground"
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
          <Icon
            className="size-4 shrink-0 text-muted-foreground/70"
            aria-hidden
          />
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

/** A quiet before → after / value line beneath a timeline event title. */
function eventSubtitle(fields: PeopleChangeFieldDto[]): ReactNode {
  if (fields.length === 0) return null;
  return fields.map((field, index) => (
    <span key={field.label}>
      {index > 0 ? " · " : null}
      {field.from ? (
        <>
          <span className="line-through decoration-muted-foreground/40">
            {field.from}
          </span>
          {" → "}
        </>
      ) : null}
      {field.to ?? "—"}
    </span>
  ));
}

function ProfileTimeline({ events }: { events: PeopleTimelineEventDto[] }) {
  if (events.length === 0) {
    return (
      <p className="type-body text-muted-foreground">
        No employment history yet.
      </p>
    );
  }
  // Oldest first: the timeline reads as a life-of-record story top to bottom.
  const ordered = [...events].sort((a, b) =>
    a.effectiveDate.localeCompare(b.effectiveDate)
  );
  const last = ordered.length - 1;
  return (
    <ol>
      {ordered.map((event, index) => {
        const subtitle = eventSubtitle(event.fields);
        return (
          <li
            key={`${event.kind}-${event.effectiveDate}-${index}`}
            className="flex gap-4"
          >
            <span className="w-[5.5rem] shrink-0 pt-0.5 text-right type-meta tabular-nums text-muted-foreground">
              {formatWorkforceDate(event.effectiveDate)}
            </span>
            <div className="flex flex-col items-center" aria-hidden>
              <span className="mt-1 size-2.5 shrink-0 rounded-full bg-primary ring-4 ring-primary/15" />
              {index < last ? <span className="w-px flex-1 bg-border" /> : null}
            </div>
            <div className={cn("min-w-0", index < last && "pb-6")}>
              <p className="type-label text-foreground">{event.title}</p>
              {subtitle ? (
                <p className="mt-0.5 type-meta text-muted-foreground">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function EditMyDetailsDialog({
  open,
  onOpenChange,
  details,
  canEditPreferredName,
  canEditPhone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  details: EmployeeDetailsDto;
  canEditPreferredName: boolean;
  canEditPhone: boolean;
}) {
  const update = useUpdateMyProfile();
  const [preferredName, setPreferredName] = useState(
    details.preferredName ?? ""
  );
  const [phone, setPhone] = useState(details.phone ?? "");
  const [error, setError] = useState<string | null>(null);

  const normalizedPreferredName = preferredName.trim() || null;
  const normalizedPhone = phone.trim() || null;
  const changed =
    (canEditPreferredName &&
      normalizedPreferredName !== details.preferredName) ||
    (canEditPhone && normalizedPhone !== details.phone);

  const save = async () => {
    setError(null);
    try {
      await update.mutateAsync({
        employeeId: details.id,
        expectedVersion: details.version,
        preferredName: canEditPreferredName
          ? normalizedPreferredName
          : undefined,
        phone: canEditPhone ? normalizedPhone : undefined,
      });
      toast.success("Profile details updated.");
      onOpenChange(false);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message.trim()
          ? cause.message
          : "Your changes could not be saved."
      );
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !update.isLoading && onOpenChange(next)}
    >
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Edit personal details</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-3">
          {canEditPreferredName ? (
            <div className="space-y-2">
              <Label htmlFor="my-preferred-name">Preferred name</Label>
              <Input
                id="my-preferred-name"
                value={preferredName}
                maxLength={100}
                onChange={(event) => setPreferredName(event.target.value)}
              />
              <p className="type-meta text-muted-foreground">
                Used as your display name across Fusion.
              </p>
            </div>
          ) : null}
          {canEditPhone ? (
            <div className="space-y-2">
              <Label htmlFor="my-phone">Phone</Label>
              <Input
                id="my-phone"
                value={phone}
                maxLength={50}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
          ) : null}
          {error ? (
            <p
              className="border-l-2 border-danger bg-danger/5 px-3 py-2 type-meta font-medium text-danger"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={update.isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void save()}
            disabled={!changed || update.isLoading}
          >
            {update.isLoading ? "Saving" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatEmploymentType(value: string | null | undefined): string {
  if (!value) return "Not set";
  const known: Record<string, string> = {
    FullTime: "Full-time",
    PartTime: "Part-time",
    Contract: "Contract",
    Contractor: "Contractor",
    Intern: "Intern",
    Temporary: "Temporary",
    Seasonal: "Seasonal",
  };
  return known[value] ?? value.replace(/([a-z])([A-Z])/g, "$1 $2");
}
