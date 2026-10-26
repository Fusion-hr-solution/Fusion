"use client";

import { useSay } from "@repo/ds/lib/say";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import {
  notFound,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
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
  canEnterPerformance,
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
import { useWorkforceDate } from "./workforce-ui";
import { WorkerProfile } from "./worker-profile/worker-profile";
import { PerformanceRecordView, RecordViewSwitcher } from "./record-views";
import { WorkerProfileSkeleton } from "./worker-profile/worker-profile-skeleton";
import { fromPeopleProfile } from "./worker-profile/worker-profile-view";
import { useRecentRecord } from "@repo/api/react";

function isoDay(value: string): string {
  return value.length >= 10 ? value.slice(0, 10) : value;
}

export default function PeopleProfileWorkspace({
  employeeKey,
  view: recordView = "profile",
}: {
  employeeKey: string;
  /** Which sibling view of the record to show under the shared header. */
  view?: "profile" | "performance";
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const asOfParam = searchParams.get("asOf");

  const { user, isLoading: authLoading } = useAuth();
  const t = useTranslations("profile.record");
  const say = useSay("profile");
  const locale = useLocale();
  const workforceDate = useWorkforceDate();
  const canManage = canManageCoreEmployees(user);
  // The Performance view exists only where the viewer can enter Performance (hide, don't deny).
  const showPerformance = canEnterPerformance(user);
  if (recordView === "performance" && !authLoading && !showPerformance)
    notFound();
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
  useRecentRecord(
    "core",
    profile.data
      ? { label: profile.data.identity.displayName, kind: "Person", href: `/core/people/${encodeURIComponent(employeeKey)}` }
      : null,
  );

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
          title={t("noAccess")}
          description={t("noAccessDescription")}
        />
      );
    }
    const transient = kind === "network" || kind === "upstream-unavailable";
    return (
      <ProfileNotice
        icon={UserRound}
        title={t("notFound")}
        description={transient ? t("transient") : t("missing")}
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
    accessEnabled ? (access.data ?? null) : null,
    { say, locale }
  );

  const showActions =
    canManage && !isAsOf && employee.employment.state !== "Former";
  const goAsOf = (date: string) => router.push(`${pathname}?asOf=${date}`);
  const returnToToday = () => router.push(pathname);

  // A colleague who is not permitted the Fusion-access read (403) simply doesn't see
  // the section — only a genuinely transient failure surfaces a retry.
  const accessForbidden =
    Boolean(access.error) && classifyApiError(access.error) === "auth";
  const accessState =
    !accessEnabled || accessForbidden
      ? undefined
      : access.isLoading
        ? ("loading" as const)
        : access.error
          ? ("error" as const)
          : ("ready" as const);
  const hasHeaderActions = isAsOf || canExplore || showActions;

  const canManageWorkEmail = canManage && !isAsOf;
  const accessAction =
    accessEnabled && access.data && canViewWorkforceAccess(user) ? (
      view.workEmail ? (
        <Link
          href="/workforce-access"
          className="inline-block type-meta text-primary-ink underline-offset-4 hover:underline"
        >
          {access.data.state === "NoAccess" ? t("setUpAccess") : t("reviewAccess")}
        </Link>
      ) : canManage ? (
        <Button
          variant="link"
          className="h-auto p-0 type-meta text-primary-ink"
          onClick={() => setWorkEmailEditorOpen(true)}
        >
          {t("addWorkEmail")}
          <ChevronRight className="ms-1 size-3.5" aria-hidden />
        </Button>
      ) : undefined
    ) : undefined;

  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {established
          ? established === "hire"
            ? t("hiredAnnouncement")
            : t("addedAnnouncement")
          : ""}
      </div>
      <WorkerProfile
        view={view}
        headingRef={headingRef}
        backLink={
          <Link
            href="/people"
            className="inline-flex items-center gap-2 type-body text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:rounded-control focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-4" /> {t("back")}
          </Link>
        }
        nameBadge={
          showResult && established ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success-subtle px-2.5 py-1 type-meta font-medium text-foreground motion-safe:animate-in motion-safe:fade-in">
              <Check className="size-3.5 text-success" aria-hidden />
              {established === "hire" ? t("hired") : t("added")}
            </span>
          ) : undefined
        }
        headerActions={
          hasHeaderActions ? (
            <>
              {isAsOf ? (
                <div className="inline-flex items-center gap-2.5 rounded-full border border-primary/30 bg-primary/[0.06] py-1.5 ps-3.5 pe-1.5 motion-safe:animate-in motion-safe:fade-in">
                  <span className="type-label">
                    {t("asOf", { date: workforceDate(employee.viewedDate, { month: "long" }) })}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1.5 rounded-full px-2.5 text-muted-foreground hover:text-foreground"
                    onClick={returnToToday}
                  >
                    <RotateCcw className="size-3.5" /> {t("today")}
                  </Button>
                </div>
              ) : canExplore ? (
                <AsOfControl
                  today={isoDay(employee.viewedDate)}
                  onPick={goAsOf}
                />
              ) : null}
              {showActions ? (
                <div className="flex items-center gap-2">
                  <Button asChild size="sm">
                    <Link href={`/people/${employeeKey}/change-work`}>
                      <BriefcaseBusiness className="size-4" /> {t("changeWork")}
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/people/${employeeKey}/change-manager`}>
                      {t("changeManager")}
                    </Link>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={t("more")}
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
                          <UserRoundX className="size-4" /> {t("endEmployment")}
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
        viewSwitcher={
          showPerformance ? (
            <RecordViewSwitcher
              profileHref={`/people/${employeeKey}`}
              performanceHref={`/people/${employeeKey}/performance`}
              current={recordView}
            />
          ) : undefined
        }
        accessState={accessState}
        onRetryAccess={() => void access.refetch()}
        timelineLoading={timeline.isLoading}
        accessAction={accessAction}
        workEmailAction={
          canManageWorkEmail ? (
            <Button
              variant="link"
              className="h-auto p-0 type-meta text-primary-ink"
              onClick={() => setWorkEmailEditorOpen(true)}
            >
              {view.workEmail ? t("editWorkEmail") : t("addWorkEmail")}
              <ChevronRight className="ms-1 size-3.5" aria-hidden />
            </Button>
          ) : undefined
        }
      >
        {recordView === "performance" && showPerformance ? (
          <PerformanceRecordView employeeId={employee.identity.employeeId} />
        ) : undefined}
      </WorkerProfile>
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
  const t = useTranslations("profile.record");
  return (
    <PageContainer>
      <Empty className="min-h-[26rem] rounded-surface border">
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
                <ArrowLeft className="size-4" /> {t("backToPeople")}
              </Link>
            </Button>
            {onRetry ? (
              <Button variant="ghost" onClick={onRetry}>
                <RotateCcw className="size-4" /> {t("retry")}
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
  const t = useTranslations("profile.record");
  return (
    <label className="inline-flex items-center gap-2 rounded-control border bg-card px-3 py-1.5 type-body text-muted-foreground focus-within:ring-2 focus-within:ring-ring">
      <CalendarDays className="size-4" aria-hidden />
      <span className="type-label">{t("asOfToday")}</span>
      <span aria-hidden className="text-muted-foreground/40">
        ·
      </span>
      <span className="sr-only">{t("viewAsOf")}</span>
      <input
        type="date"
        defaultValue={today}
        onChange={(event) => {
          if (event.target.value) onPick(event.target.value);
        }}
        className="bg-transparent text-foreground outline-none [color-scheme:light] dark:[color-scheme:dark]"
        aria-label={t("viewAsOfDate")}
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
  const t = useTranslations("profile.workEmail");
  const english = useLocale() === "en";
  const record = useTranslations("profile.record");
  const editTitle = record("editWorkEmail");
  const addTitle = record("addWorkEmail");
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
      setError(t("required"));
      return;
    }

    setError(null);
    try {
      await updateWorkEmail.mutateAsync({ workEmail, expectedVersion });
      toast.success(currentEmail ? t("updated") : t("added"));
      onOpenChange(false);
      if (returnTo) router.push(returnTo);
    } catch (mutationError) {
      setError(
        english && mutationError instanceof Error && mutationError.message.trim()
          ? mutationError.message
          : t("failed")
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
            {currentEmail ? editTitle : addTitle}
          </DialogTitle>
        </DialogHeader>

        <form
          className="space-y-5 py-3"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <div className="rounded-surface border bg-inlay px-4 py-3">
            <p className="type-label">{displayName}</p>
            <p className="mt-1 type-code text-muted-foreground">
              {employeeNumber}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="people-work-email">{t("label")}</Label>
            <Input
              id="people-work-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={updateWorkEmail.isLoading}
              placeholder={t("placeholder")}
              aria-invalid={error ? true : undefined}
            />
            <p className="type-meta text-muted-foreground">
              {t("hint")}
            </p>
          </div>

          {error ? (
            <p
              className="rounded-control bg-danger/10 px-3 py-2 type-meta font-medium text-danger"
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
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!draft.trim() || updateWorkEmail.isLoading}
            >
              {updateWorkEmail.isLoading ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
