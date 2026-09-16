"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  Input,
  Label,
} from "@repo/ds";
import { PageContainer } from "@repo/ds/shell";
import { toast } from "sonner";
import { useBreadcrumbLabel } from "@/shell/breadcrumb-overrides";
import {
  canAccessCorePeople,
  canAccessCoreTeam,
  canManageCoreEmployees,
  canViewWorkforceAccess,
  useAuth,
} from "@repo/auth";
import { classifyApiError } from "@repo/api";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronRight,
  MoreHorizontal,
  RotateCcw,
  ShieldAlert,
  UserRound,
  UserRoundX,
} from "lucide-react";
import {
  usePeopleAccessStatus,
  usePeopleProfile,
  usePeopleTimeline,
  useUpdatePeopleWorkEmail,
} from "../api/use-people";
import { formatWorkforceDate } from "./workforce-ui";
import { WorkerProfile } from "./worker-profile/worker-profile";
import { WorkerProfileSkeleton } from "./worker-profile/worker-profile-skeleton";
import { fromPeopleProfile } from "./worker-profile/worker-profile-view";

function isoDay(value: string): string {
  return value.length >= 10 ? value.slice(0, 10) : value;
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

  const { user } = useAuth();
  const canManage = canManageCoreEmployees(user);
  // History and Fusion-access mirror the backend's manager/HR gates; a plain
  // colleague never fetches them, so nothing flashes a skeleton it can't fill.
  const canExplore = canAccessCoreTeam(user);
  const canSeeAccess = canAccessCorePeople(user);

  const profile = usePeopleProfile(employeeKey, asOfParam);
  const timeline = usePeopleTimeline(
    employeeKey,
    Boolean(profile.data) && canExplore
  );
  const access = usePeopleAccessStatus(
    employeeKey,
    Boolean(profile.data) && !asOfParam && canSeeAccess
  );
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

  if (profile.isLoading) return <WorkerProfileSkeleton showBackLink />;

  if (profile.error || !profile.data) {
    const kind = profile.error ? classifyApiError(profile.error) : "validation";
    if (kind === "auth") {
      return (
        <ProfileNotice
          icon={ShieldAlert}
          title="You don't have access to this profile"
          description="Your role does not permit viewing this worker."
        />
      );
    }
    const transient = kind === "network" || kind === "upstream-unavailable";
    return (
      <ProfileNotice
        icon={UserRound}
        title="Worker not found"
        description={
          transient
            ? "This profile could not be loaded right now. Try again in a moment."
            : "This worker may not exist or may not be available in this tenant."
        }
        onRetry={
          profile.error && (transient || kind === "unexpected")
            ? () => void profile.refetch()
            : undefined
        }
      />
    );
  }

  const employee = profile.data;
  const isAsOf = employee.isAsOf;
  const accessEnabled = !isAsOf && canSeeAccess;
  const view = fromPeopleProfile(
    employee,
    timeline.data?.timeline,
    accessEnabled ? (access.data ?? null) : null
  );

  const showActions = canManage && !isAsOf && employee.employment.state !== "Former";
  const goAsOf = (date: string) => router.push(`${pathname}?asOf=${date}`);
  const returnToToday = () => router.push(pathname);

  // A colleague who is not permitted the Fusion-access read (403) simply doesn't see
  // the section — only a genuinely transient failure surfaces a retry.
  const accessForbidden =
    Boolean(access.error) && classifyApiError(access.error) === "auth";
  const accessState = !accessEnabled || accessForbidden
    ? undefined
    : access.isLoading
      ? ("loading" as const)
      : access.error
        ? ("error" as const)
        : ("ready" as const);
  const hasHeaderActions = isAsOf || canExplore || showActions;

  const canManageWorkEmail = canManage && !isAsOf;
  const accessAction =
    accessEnabled && access.data && canViewWorkforceAccess(user)
      ? view.workEmail ? (
          <Link
            href="/workforce-access"
            className="inline-block type-meta text-primary underline-offset-4 hover:underline"
          >
            {access.data.state === "NoAccess"
              ? "Set up workforce access"
              : "Review workforce access"}
          </Link>
        ) : canManage ? (
          <Button
            variant="link"
            className="h-auto p-0 type-meta text-primary"
            onClick={() => setWorkEmailEditorOpen(true)}
          >
            Add work email
            <ChevronRight className="ml-1 size-3.5" aria-hidden />
          </Button>
        ) : undefined
      : undefined;

  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {established
          ? established === "hire"
            ? "Employee hired."
            : "Employee added."
          : ""}
      </div>
      <WorkerProfile
        view={view}
        headingRef={headingRef}
        backLink={
          <Link
            href="/people"
            className="inline-flex items-center gap-2 type-body text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-4" /> People
          </Link>
        }
        nameBadge={
          showResult && established ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success-subtle px-2.5 py-1 type-meta font-medium text-foreground motion-safe:animate-in motion-safe:fade-in">
              <Check className="size-3.5 text-success" aria-hidden />
              {established === "hire" ? "Hired" : "Added"}
            </span>
          ) : undefined
        }
        headerActions={
          hasHeaderActions ? (
          <>
            {isAsOf ? (
              <div className="inline-flex items-center gap-2.5 rounded-full border border-primary/30 bg-primary/[0.06] py-1.5 pl-3.5 pr-1.5 motion-safe:animate-in motion-safe:fade-in">
                <span className="type-label">
                  As of {formatWorkforceDate(employee.viewedDate, { month: "long" })}
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
            ) : canExplore ? (
              <AsOfControl today={isoDay(employee.viewedDate)} onPick={goAsOf} />
            ) : null}
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
                    <Button size="icon" variant="ghost" aria-label="More actions">
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
          </>
          ) : undefined
        }
        onViewAsOf={goAsOf}
        accessState={accessState}
        onRetryAccess={() => void access.refetch()}
        timelineLoading={timeline.isLoading}
        accessAction={accessAction}
        workEmailAction={
          canManageWorkEmail ? (
            <Button
              variant="link"
              className="h-auto p-0 type-meta text-primary"
              onClick={() => setWorkEmailEditorOpen(true)}
            >
              {view.workEmail ? "Edit work email" : "Add work email"}
              <ChevronRight className="ml-1 size-3.5" aria-hidden />
            </Button>
          ) : undefined
        }
      />
      <WorkEmailEditorDialog
        open={workEmailEditorOpen}
        onOpenChange={setWorkEmailEditorOpen}
        employeeKey={employeeKey}
        displayName={employee.identity.displayName}
        employeeNumber={employee.identity.employeeNumber}
        currentEmail={employee.identity.workEmail}
        expectedVersion={employee.version}
        returnTo={returnTo}
      />
    </>
  );
}

function ProfileNotice({
  icon: Icon,
  title,
  description,
  onRetry,
}: {
  icon: typeof UserRound;
  title: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <PageContainer>
      <Empty className="min-h-[26rem] rounded-2xl border">
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/people">
                <ArrowLeft className="size-4" /> Back to People
              </Link>
            </Button>
            {onRetry ? (
              <Button variant="ghost" onClick={onRetry}>
                <RotateCcw className="size-4" /> Retry
              </Button>
            ) : null}
          </div>
        </EmptyContent>
      </Empty>
    </PageContainer>
  );
}

/** Quiet Today-only affordance to view the worker as of another date. */
function AsOfControl({
  today,
  onPick,
}: {
  today: string;
  onPick: (date: string) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 type-body text-muted-foreground focus-within:ring-2 focus-within:ring-ring">
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
            <p className="mt-1 type-code text-muted-foreground">{employeeNumber}</p>
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
              The canonical People value Fusion resolves workforce access against.
            </p>
          </div>

          {error ? (
            <p
              className="border-l-2 border-danger bg-danger/5 px-3 py-2 type-meta font-medium text-danger"
              role="alert"
            >
              {error}
            </p>
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
            <Button type="submit" disabled={!draft.trim() || updateWorkEmail.isLoading}>
              {updateWorkEmail.isLoading ? "Saving..." : "Save work email"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
