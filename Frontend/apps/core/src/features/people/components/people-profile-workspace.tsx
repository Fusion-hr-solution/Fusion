"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Skeleton,
  cn,
} from "@repo/ds";
import { PageContainer } from "@repo/ds/shell";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBreadcrumbLabel } from "@/shell/breadcrumb-overrides";
import {
  canManageCoreEmployees,
  canViewWorkforceAccess,
  useAuth,
} from "@repo/auth";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronRight,
  MoreHorizontal,
  Phone,
  RotateCcw,
  UserRound,
  UserRoundX,
} from "lucide-react";
import type {
  PeopleChangeFieldDto,
  PeopleProfileDto,
  PeopleTimelineEventDto,
  PeopleUpcomingChangeDto,
} from "@repo/api";
import {
  usePeopleAccessStatus,
  usePeopleProfile,
  usePeopleTimeline,
  useUpdatePeopleWorkEmail,
} from "../api/use-people";
import {
  EmployeeIdentity,
  EmploymentStatus,
  Monogram,
  OrgPath,
  formatWorkforceDate,
} from "./workforce-ui";

function employmentLine(employment: PeopleProfileDto["employment"]): string {
  const { state, start, end } = employment;
  if (state === "Scheduled")
    return start
      ? `Starts ${formatWorkforceDate(start, { month: "long" })}`
      : "Starts later";
  if (state === "Former") {
    if (start && end)
      return `${formatWorkforceDate(start, { month: "long" })} – ${formatWorkforceDate(end, { month: "long" })}`;
    return end
      ? `Ended ${formatWorkforceDate(end, { month: "long" })}`
      : "Employment ended";
  }
  if (state === "Incomplete") return "Not employed on this date";
  return start
    ? `Since ${formatWorkforceDate(start, { month: "long" })}`
    : "Active";
}

function isoDay(value: string): string {
  return value.length >= 10 ? value.slice(0, 10) : value;
}

function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={cn("type-eyebrow text-muted-foreground", className)}>
      {children}
    </h2>
  );
}

/** from → to for a single changed field; a single value renders alone. */
function ChangeField({ field }: { field: PeopleChangeFieldDto }) {
  return (
    <p className="type-body">
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
      <span className="font-medium">{field.to ?? "—"}</span>
    </p>
  );
}

function ProfileSkeleton() {
  return (
    <PageContainer width="wide" className="pb-16">
      <div className="mx-auto max-w-5xl">
        <Skeleton className="mb-8 h-5 w-20" />
        <div className="flex items-center gap-5 border-b pb-8">
          <Skeleton className="size-16 rounded-[0.625rem]" />
          <div className="space-y-2.5">
            <Skeleton className="h-9 w-72" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <Skeleton className="mt-8 h-40 w-full rounded-2xl" />
        <div className="mt-10 grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

function WorkEmailEditorDialog({
  open,
  onOpenChange,
  employeeKey,
  displayName,
  employeeNumber,
  currentEmail,
  expectedVersion,
  returnTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeKey: string;
  displayName: string;
  employeeNumber: string;
  currentEmail: string | null;
  expectedVersion: number;
  returnTo: string | null;
}) {
  const router = useRouter();
  const updateWorkEmail = useUpdatePeopleWorkEmail(employeeKey);
  const [draft, setDraft] = useState(currentEmail ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(currentEmail ?? "");
    setError(null);
  }, [currentEmail, open]);

  async function handleSubmit() {
    const workEmail = draft.trim().toLowerCase();
    if (!workEmail) {
      setError("Enter a work email.");
      return;
    }

    setError(null);
    try {
      await updateWorkEmail.mutateAsync({ workEmail, expectedVersion });
      toast.success(currentEmail ? "Work email updated." : "Work email added.");
      onOpenChange(false);
      if (returnTo) router.push(returnTo);
    } catch (mutationError) {
      setError(
        mutationError instanceof Error && mutationError.message.trim()
          ? mutationError.message
          : "The work email could not be saved. Review it and try again."
      );
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!updateWorkEmail.isLoading) onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {currentEmail ? "Edit work email" : "Add work email"}
          </DialogTitle>
        </DialogHeader>

        <form
          className="space-y-5 py-3"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <div className="rounded-xl border bg-muted/10 px-4 py-3">
            <p className="type-label">{displayName}</p>
            <p className="mt-1 type-code text-muted-foreground">
              {employeeNumber}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="people-work-email">Work email</Label>
            <Input
              id="people-work-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={updateWorkEmail.isLoading}
              placeholder="name@company.com"
              aria-invalid={error ? true : undefined}
            />
            <p className="type-meta text-muted-foreground">
              This canonical People value is used when Fusion resolves workforce
              access.
            </p>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Work email could not be saved</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateWorkEmail.isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!draft.trim() || updateWorkEmail.isLoading}
            >
              {updateWorkEmail.isLoading ? "Saving..." : "Save work email"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WorkIdentitySection({
  employeeNumber,
  workEmail,
  canManage,
  readOnly,
  onEditEmail,
}: {
  employeeNumber: string;
  workEmail: string | null;
  canManage: boolean;
  readOnly: boolean;
  onEditEmail: () => void;
}) {
  return (
    <section>
      <Eyebrow>Work identity</Eyebrow>
      <div className="mt-3 space-y-3">
        <div>
          <p className="type-meta text-muted-foreground">Employee number</p>
          <p className="mt-0.5 type-code text-foreground">{employeeNumber}</p>
        </div>
        <div className="border-t pt-3">
          <p className="type-meta text-muted-foreground">Work email</p>
          <p
            className={cn(
              "mt-0.5 type-body",
              !workEmail && "text-muted-foreground"
            )}
          >
            {workEmail ?? "Not set"}
          </p>
          {!workEmail ? (
            <p className="mt-1 type-meta text-muted-foreground">
              Required before Fusion access can be set up.
            </p>
          ) : null}
          {canManage && !readOnly ? (
            <Button
              variant="link"
              className="mt-2 h-auto p-0 type-meta text-primary"
              onClick={onEditEmail}
            >
              {workEmail ? "Edit work email" : "Add work email"}
              <ChevronRight className="ml-1 size-3.5" aria-hidden />
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default function PeopleProfileWorkspace({
  employeeKey,
}: {
  employeeKey: string;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const asOfParam = searchParams.get("asOf");

  const profile = usePeopleProfile(employeeKey, asOfParam);
  const timeline = usePeopleTimeline(employeeKey, Boolean(profile.data));
  const access = usePeopleAccessStatus(
    employeeKey,
    Boolean(profile.data) && !asOfParam
  );

  const { user } = useAuth();
  const canManage = canManageCoreEmployees(user);
  const [workEmailEditorOpen, setWorkEmailEditorOpen] = useState(false);
  const workEmailActionHandled = useRef(false);
  const requestedAction = searchParams.get("action");
  const returnTo =
    searchParams.get("returnTo") === "/core/workforce-access"
      ? "/core/workforce-access"
      : null;

  const established = searchParams.get("established");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [showResult, setShowResult] = useState(Boolean(established));
  useBreadcrumbLabel(employeeKey, profile.data?.identity.displayName);

  useEffect(() => {
    if (profile.data && established) headingRef.current?.focus();
  }, [established, profile.data]);

  useEffect(() => {
    if (!showResult) return;
    const timer = window.setTimeout(() => setShowResult(false), 6000);
    return () => window.clearTimeout(timer);
  }, [showResult]);

  useEffect(() => {
    if (requestedAction !== "work-email") {
      workEmailActionHandled.current = false;
      return;
    }
    if (
      workEmailActionHandled.current ||
      !profile.data ||
      !canManage ||
      profile.data.isAsOf
    ) {
      return;
    }

    workEmailActionHandled.current = true;
    setWorkEmailEditorOpen(true);
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.delete("action");
    const nextSearch = nextSearchParams.toString();
    window.history.replaceState(
      window.history.state,
      "",
      nextSearch ? `${pathname}?${nextSearch}` : pathname
    );
  }, [canManage, pathname, profile.data, requestedAction, searchParams]);

  if (profile.isLoading) return <ProfileSkeleton />;
  if (profile.error || !profile.data) {
    return (
      <PageContainer>
        <Empty className="min-h-[26rem] rounded-2xl border">
          <EmptyMedia variant="icon">
            <UserRound />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Employee not found</EmptyTitle>
            <EmptyDescription>
              The employee may not exist or may not be available in this tenant.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href="/people">
                  <ArrowLeft className="size-4" /> Back to People
                </Link>
              </Button>
              {profile.error ? (
                <Button variant="ghost" onClick={() => void profile.refetch()}>
                  <RotateCcw className="size-4" /> Retry
                </Button>
              ) : null}
            </div>
          </EmptyContent>
        </Empty>
      </PageContainer>
    );
  }

  const employee = profile.data;
  const { identity, employment, work } = employee;
  const isAsOf = employee.isAsOf;
  const scheduled = employment.state === "Scheduled";
  const upcoming = employee.upcoming;
  const hasContact = Boolean(identity.phone);
  const showActions = canManage && !isAsOf && employment.state !== "Former";

  const goAsOf = (date: string) => router.push(`${pathname}?asOf=${date}`);
  const returnToToday = () => router.push(pathname);

  return (
    <PageContainer width="wide" className="pb-16">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/people"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" /> People
        </Link>

        <div role="status" aria-live="polite" className="sr-only">
          {established
            ? established === "hire"
              ? "Employee hired."
              : "Employee added."
            : ""}
        </div>

        {/* Identity header — presence at the top, actions and as-of anchored to the right */}
        <header className="mt-5 flex flex-wrap items-start justify-between gap-x-6 gap-y-5 border-b pb-6">
          <div className="flex min-w-0 items-center gap-5">
            <Monogram
              name={identity.displayName}
              size="xl"
              accent={scheduled}
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="type-display text-balance outline-none"
                >
                  {identity.displayName}
                </h1>
                {showResult && established ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success-subtle px-2.5 py-1 type-meta font-medium text-foreground motion-safe:animate-in motion-safe:fade-in">
                    <Check className="size-3.5 text-success" aria-hidden />{" "}
                    {established === "hire" ? "Hired" : "Added"}
                  </span>
                ) : null}
              </div>
              {work ? (
                <p className="mt-1.5 text-[0.95rem] leading-6">
                  {work.jobTitle}
                  <span className="text-muted-foreground">
                    {" "}
                    · {work.organizationName}
                  </span>
                </p>
              ) : (
                <p className="mt-1.5 type-body text-muted-foreground">
                  Work details unavailable
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                <EmploymentStatus state={employment.state} />
                <span aria-hidden className="text-muted-foreground/40">
                  ·
                </span>
                <span className="type-code text-xs text-muted-foreground">
                  {identity.employeeNumber}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            {isAsOf ? (
              <div className="inline-flex items-center gap-2.5 rounded-full border border-primary/30 bg-primary/[0.06] py-1.5 pl-3.5 pr-1.5 motion-safe:animate-in motion-safe:fade-in">
                <span className="type-label">
                  As of{" "}
                  {formatWorkforceDate(employee.viewedDate, { month: "long" })}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1.5 rounded-full px-2.5 text-muted-foreground hover:text-foreground"
                  onClick={returnToToday}
                >
                  <RotateCcw className="size-3.5" /> Today
                </Button>
              </div>
            ) : (
              <AsOfControl
                today={isoDay(employee.viewedDate)}
                onPick={goAsOf}
              />
            )}
            {showActions ? (
              <div className="flex items-center gap-2">
                <Button asChild size="sm">
                  <Link href={`/people/${employeeKey}/change-work`}>
                    <BriefcaseBusiness className="size-4" /> Change work
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/people/${employeeKey}/change-manager`}>
                    Change manager
                  </Link>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="More actions"
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link
                        href={`/people/${employeeKey}/end-employment`}
                        className="text-destructive focus:text-destructive"
                      >
                        <UserRoundX className="size-4" /> End employment
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : null}
          </div>
        </header>

        {/* Current state — the center of gravity: one coherent state for this person and date */}
        <CurrentState employee={employee} />

        {/* Upcoming — delta-first, collapses entirely when empty */}
        {!isAsOf && upcoming.length > 0 ? (
          <section className="mt-8 motion-safe:animate-in motion-safe:fade-in">
            <Eyebrow>Upcoming</Eyebrow>
            <ul className="mt-3.5 grid gap-3 sm:grid-cols-2">
              {upcoming.map((item, index) => (
                <UpcomingCard
                  key={`${item.kind}-${item.effectiveDate}-${index}`}
                  item={item}
                  onView={() => goAsOf(isoDay(item.effectiveDate))}
                />
              ))}
            </ul>
          </section>
        ) : null}

        {/* Lower region: timeline is the spine; people & access sit alongside as anchored context */}
        <div className="mt-10 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
          <div className="order-2 min-w-0 lg:order-1">
            <TimelineSection
              events={timeline.data?.timeline}
              loading={timeline.isLoading}
            />
          </div>

          <div className="order-1 min-w-0 space-y-8 lg:order-2">
            {employee.directReportCount > 0 ? (
              <section>
                <Eyebrow>Direct reports · {employee.directReportCount}</Eyebrow>
                <ul className="mt-3.5 space-y-3.5">
                  {employee.directReports.map((report) => (
                    <li key={report.employeeKey}>
                      <EmployeeIdentity
                        name={report.displayName}
                        href={`/people/${report.employeeKey}`}
                        secondary={report.jobTitle ?? undefined}
                        size="sm"
                      />
                    </li>
                  ))}
                  {employee.directReportCount >
                  employee.directReports.length ? (
                    <li className="pl-11 type-meta text-muted-foreground">
                      +
                      {employee.directReportCount -
                        employee.directReports.length}{" "}
                      more
                    </li>
                  ) : null}
                </ul>
              </section>
            ) : null}

            <WorkIdentitySection
              employeeNumber={identity.employeeNumber}
              workEmail={identity.workEmail}
              canManage={canManage}
              readOnly={isAsOf}
              onEditEmail={() => setWorkEmailEditorOpen(true)}
            />

            {!isAsOf ? (
              <section>
                <Eyebrow>Fusion account</Eyebrow>
                <div className="mt-2">
                  {access.isLoading ? (
                    <Skeleton className="h-5 w-24" />
                  ) : access.error ? (
                    <>
                      <p className="type-body font-medium">
                        Status unavailable
                      </p>
                      <Button
                        variant="link"
                        className="h-auto p-0 text-sm"
                        onClick={() => void access.refetch()}
                      >
                        Retry
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="type-body font-medium">
                        {access.data?.label ?? "Not linked"}
                      </p>
                      {access.data?.detail ? (
                        <p className="truncate type-meta text-muted-foreground">
                          {access.data.detail}
                        </p>
                      ) : null}
                      {canViewWorkforceAccess(user) ? (
                        identity.workEmail ? (
                          <Link
                            href="/workforce-access"
                            className="mt-1.5 inline-block type-meta text-primary underline-offset-4 hover:underline"
                          >
                            {access.data?.state === "NoAccess"
                              ? "Set up workforce access"
                              : "Review workforce access"}
                          </Link>
                        ) : canManage ? (
                          <Button
                            variant="link"
                            className="mt-1.5 h-auto p-0 type-meta text-primary"
                            onClick={() => setWorkEmailEditorOpen(true)}
                          >
                            Add work email
                            <ChevronRight
                              className="ml-1 size-3.5"
                              aria-hidden
                            />
                          </Button>
                        ) : null
                      ) : null}
                    </>
                  )}
                </div>
              </section>
            ) : null}

            {hasContact ? (
              <section>
                <Eyebrow>Contact</Eyebrow>
                <ul className="mt-2.5 space-y-2.5">
                  {identity.phone ? (
                    <li className="flex items-center gap-2.5">
                      <Phone
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <span className="type-body">{identity.phone}</span>
                    </li>
                  ) : null}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
      </div>
      <WorkEmailEditorDialog
        open={workEmailEditorOpen}
        onOpenChange={setWorkEmailEditorOpen}
        employeeKey={employeeKey}
        displayName={identity.displayName}
        employeeNumber={identity.employeeNumber}
        currentEmail={identity.workEmail}
        expectedVersion={employee.version}
        returnTo={returnTo}
      />
    </PageContainer>
  );
}

/**
 * The current (or as-of) workforce state, presented as one coherent object: Work
 * is the dominant fact, with Reporting and Employment as anchored supporting facts
 * about the same person and date — not three equal cards.
 */
function CurrentState({ employee }: { employee: PeopleProfileDto }) {
  const { work, primaryManager, employment, isAsOf } = employee;
  const accent = employment.state === "Scheduled";
  return (
    <section
      aria-label="Current workforce state"
      className={cn(
        "mt-8 overflow-hidden rounded-2xl border bg-card",
        accent && "ring-1 ring-inset ring-primary/20"
      )}
    >
      <div className="grid lg:grid-cols-[1.5fr_minmax(0,1fr)]">
        <div className="p-6">
          <Eyebrow>{isAsOf ? "Work on this date" : "Current work"}</Eyebrow>
          {work ? (
            <div className="mt-3">
              <p className="type-section-title text-foreground">
                {work.jobTitle}
              </p>
              <div className="mt-1.5">
                <OrgPath
                  name={work.organizationName}
                  path={work.organizationPath}
                  unitClassName="type-panel-title text-foreground"
                />
              </div>
              <p className="mt-2.5 type-meta text-muted-foreground">
                {work.location ? <>{work.location} · </> : null}
                Effective from{" "}
                {formatWorkforceDate(work.effectiveFrom, { month: "long" })}
              </p>
            </div>
          ) : (
            <p className="mt-3 type-body text-muted-foreground">
              Work details unavailable on this date.
            </p>
          )}
        </div>

        <div className="grid divide-y border-t lg:border-l lg:border-t-0">
          <div className="p-6">
            <Eyebrow>Reporting to</Eyebrow>
            <div className="mt-3">
              {primaryManager ? (
                <EmployeeIdentity
                  name={primaryManager.displayName}
                  employeeNumber={primaryManager.employeeNumber}
                  href={`/people/${primaryManager.employeeKey}`}
                  size="sm"
                />
              ) : (
                <p className="type-body text-muted-foreground">No manager</p>
              )}
            </div>
          </div>
          <div className="p-6">
            <Eyebrow>Employment</Eyebrow>
            <div className="mt-3 flex items-center gap-2.5">
              <EmploymentStatus state={employment.state} />
              <span className="type-body text-muted-foreground">
                {employmentLine(employment)}
              </span>
            </div>
            {employment.employmentType ? (
              <p className="mt-1.5 type-meta text-muted-foreground">
                {employment.employmentType}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Quiet Today-only affordance to view the employee as of another date. */
function AsOfControl({
  today,
  onPick,
}: {
  today: string;
  onPick: (date: string) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm text-muted-foreground focus-within:ring-2 focus-within:ring-ring">
      <CalendarDays className="size-4" aria-hidden />
      <span className="type-label">As of Today</span>
      <span aria-hidden className="text-muted-foreground/40">
        ·
      </span>
      <span className="sr-only">View as of a date</span>
      <input
        type="date"
        defaultValue={today}
        onChange={(event) => {
          if (event.target.value) onPick(event.target.value);
        }}
        className="bg-transparent text-foreground outline-none [color-scheme:light] dark:[color-scheme:dark]"
        aria-label="View as of date"
      />
    </label>
  );
}

function UpcomingCard({
  item,
  onView,
}: {
  item: PeopleUpcomingChangeDto;
  onView: () => void;
}) {
  const kindLabel = item.kind === "Work" ? "Work change" : "Manager change";
  return (
    <li className="group flex flex-col justify-between gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/30 motion-reduce:transition-none">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 type-meta font-medium text-primary tabular-nums">
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
      <Button
        size="sm"
        variant="ghost"
        className="-ml-2 self-start text-muted-foreground group-hover:text-foreground"
        onClick={onView}
      >
        View as of {formatWorkforceDate(item.effectiveDate)}{" "}
        <ChevronRight className="size-4" />
      </Button>
    </li>
  );
}

function TimelineSection({
  events,
  loading,
}: {
  events?: PeopleTimelineEventDto[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <section>
        <Eyebrow>History</Eyebrow>
        <div className="mt-4 space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      </section>
    );
  }
  if (!events || events.length === 0) return null;
  const last = events.length - 1;
  return (
    <section>
      <Eyebrow>History</Eyebrow>
      <ol className="mt-4">
        {events.map((event, index) => (
          <li
            key={`${event.kind}-${event.effectiveDate}-${index}`}
            className="flex gap-4"
          >
            <span
              className={cn(
                "w-[5.5rem] shrink-0 pt-1.5 text-right type-meta tabular-nums",
                event.isFuture ? "text-primary" : "text-muted-foreground"
              )}
            >
              {formatWorkforceDate(event.effectiveDate)}
            </span>
            <div className="flex flex-col items-center" aria-hidden>
              <span
                className={cn(
                  "mt-1.5 size-2.5 shrink-0 rounded-full",
                  event.isFuture ? "bg-primary" : "bg-muted-foreground/35"
                )}
              />
              {index < last ? <span className="w-px flex-1 bg-border" /> : null}
            </div>
            <div className={cn("min-w-0 pt-0.5", index < last && "pb-6")}>
              <p className="type-label">{event.title}</p>
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
    </section>
  );
}
