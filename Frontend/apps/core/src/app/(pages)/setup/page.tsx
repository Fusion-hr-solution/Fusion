"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ClipboardList,
  Flag,
  History,
  LockKeyhole,
  Rocket,
  ShieldCheck,
} from "lucide-react";
import { ApiError } from "@repo/api";
import { useTenantContext } from "@/components/core-tenant-context-provider";
import { buildTenantContextHref } from "@/lib/tenant-navigation";
import type {
  CoreSetupPhase,
  DraftSetupIssueCategory,
  DraftSetupIssueDto,
  TenantSetupActivityDto,
  TenantSetupStateDto,
} from "@repo/api";
import { canAccessCoreSetup, useAuth } from "@repo/auth";
import { EmptyState } from "@repo/ui";
import { useCoreSetupAccess } from "@/components/core-setup-access";
import { CorePageLoadingState } from "@/components/core-page-loading-state";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SetupStatusBadge } from "./setup-status-badge";
import {
  useApproveStructure,
  usePublishStructure,
  useReopenStructure,
  useSetupReadiness,
} from "./use-setup";
import { SETUP_DRAFT_ENTRY_PATH } from "./setup-entry-routing";

type SetupMilestoneKey = "activated" | "structurallyGoverned" | "operational";

const SETUP_STEPS: Array<{
  key: SetupMilestoneKey;
  title: string;
  icon: typeof Flag;
}> = [
  {
    key: "activated",
    title: "Setup started",
    icon: Flag,
  },
  {
    key: "structurallyGoverned",
    title: "Structure approved",
    icon: ShieldCheck,
  },
  {
    key: "operational",
    title: "Setup complete",
    icon: Rocket,
  },
];

const ISSUE_CATEGORY_LABELS: Record<DraftSetupIssueCategory, string> = {
  structure: "Structure",
  hierarchy: "Hierarchy",
  unitTypes: "Unit types",
  requiredDetails: "Required details",
};

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Not recorded yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getCurrentMilestoneKey(
  phase: CoreSetupPhase
): SetupMilestoneKey | null {
  switch (phase) {
    case "activated":
      return "activated";
    case "structurallyGoverned":
      return "structurallyGoverned";
    case "structurallyPublished":
    case "operational":
      return "operational";
    default:
      return null;
  }
}

function isSetupCompletePhase(phase: CoreSetupPhase) {
  return phase === "structurallyPublished" || phase === "operational";
}

function getCompletedMilestoneCount(data: TenantSetupStateDto | undefined) {
  if (!data || data.canStartSetup) {
    return 0;
  }

  const currentStepKey = getCurrentMilestoneKey(data.currentPhase);

  if (!currentStepKey) {
    return 0;
  }

  return SETUP_STEPS.findIndex((step) => step.key === currentStepKey) + 1;
}

function getStepState(
  stepKey: SetupMilestoneKey,
  data: TenantSetupStateDto | undefined
) {
  if (!data || data.canStartSetup) {
    return "upcoming" as const;
  }

  const stepOrder = SETUP_STEPS.map((step) => step.key);
  const stepIndex = stepOrder.indexOf(stepKey);
  const currentStepKey = getCurrentMilestoneKey(data.currentPhase);
  const currentIndex = currentStepKey ? stepOrder.indexOf(currentStepKey) : -1;

  if (currentIndex > stepIndex) {
    return "complete" as const;
  }

  if (currentIndex === stepIndex) {
    if (stepKey === "operational") {
      return "complete" as const;
    }

    return "current" as const;
  }

  return "upcoming" as const;
}

function getHeroCopy({
  phase,
  hasDraftUnits,
  isReadyForApproval,
  blockingIssueCount,
}: {
  phase: CoreSetupPhase;
  hasDraftUnits: boolean;
  isReadyForApproval: boolean;
  blockingIssueCount: number;
}) {
  if (isSetupCompletePhase(phase)) {
    return {
      title: "Setup complete",
      description:
        "The published structure is live and the workspace is unlocked.",
    };
  }

  if (phase === "structurallyGoverned") {
    return {
      title: "Publish the approved structure",
      description:
        "The approved structure is locked. Publish it when you are ready to make it live.",
    };
  }

  if (!hasDraftUnits) {
    return {
      title: "Start the draft",
      description:
        "Open Draft Structure to add the first units or import a template.",
    };
  }

  if (blockingIssueCount > 0) {
    return {
      title: "Clear draft blockers",
      description:
        "Resolve blocking issues in Draft Structure, then return here for approval.",
    };
  }

  if (isReadyForApproval) {
    return {
      title: "Approve the draft",
      description:
        "Checks are clean. Approve the structure to lock it for publish.",
    };
  }

  return {
    title: "Review the draft",
    description:
      "Finish the structure details in Draft Structure before approval.",
  };
}

function getHeaderDescription({
  phase,
  hasDraftUnits,
  isReadyForApproval,
  blockingIssueCount,
}: {
  phase: CoreSetupPhase;
  hasDraftUnits: boolean;
  isReadyForApproval: boolean;
  blockingIssueCount: number;
}) {
  if (isSetupCompletePhase(phase)) {
    return "Review the published result and recent setup activity here.";
  }

  if (phase === "structurallyGoverned") {
    return "Review the approved structure here, then publish or reopen it.";
  }

  if (!hasDraftUnits) {
    return "Use Draft Structure to start the hierarchy, then return here for approval and publish.";
  }

  if (blockingIssueCount > 0) {
    return "Use Draft Structure for fixes; use this page for approval and publish.";
  }

  return isReadyForApproval
    ? "Use this page to approve now or return to Draft Structure for final checks."
    : "Use Draft Structure for edits; use this page to manage approval and publish.";
}

function getMetricsSummary({
  phase,
  hasDraftUnits,
  blockingIssueCount,
  warningCount,
}: {
  phase: CoreSetupPhase;
  hasDraftUnits: boolean;
  blockingIssueCount: number;
  warningCount: number;
}) {
  if (!hasDraftUnits) {
    return "Draft not started.";
  }

  if (blockingIssueCount > 0) {
    return `${blockingIssueCount} blocker${blockingIssueCount === 1 ? "" : "s"} to clear${warningCount > 0 ? ` • ${warningCount} warning${warningCount === 1 ? "" : "s"}` : ""}.`;
  }

  if (warningCount > 0) {
    return `${warningCount} warning${warningCount === 1 ? "" : "s"} to review.`;
  }

  if (isSetupCompletePhase(phase)) {
    return "Checks passed.";
  }

  return phase === "structurallyGoverned"
    ? "Ready to publish."
    : "Ready for approval.";
}

function getApprovalDisabledHint({
  hasDraftUnits,
  blockingIssueCount,
  isReadyForApproval,
  isReadinessLoading,
}: {
  hasDraftUnits: boolean;
  blockingIssueCount: number;
  isReadyForApproval: boolean;
  isReadinessLoading: boolean;
}) {
  if (isReadinessLoading) {
    return "Checking readiness...";
  }

  if (!hasDraftUnits) {
    return "Add units before approval.";
  }

  if (!isReadyForApproval || blockingIssueCount > 0) {
    return "Resolve blockers before approval.";
  }

  return null;
}

function getPublishDisabledHint({
  blockingIssueCount,
  isReadyForApproval,
  isReadinessLoading,
}: {
  blockingIssueCount: number;
  isReadyForApproval: boolean;
  isReadinessLoading: boolean;
}) {
  if (isReadinessLoading) {
    return "Checking readiness...";
  }

  if (!isReadyForApproval || blockingIssueCount > 0) {
    return "Resolve blockers before publishing.";
  }

  return null;
}

function formatRoleLabel(
  role: string | null | undefined,
  fallback = "Reviewer"
) {
  switch (role) {
    case "HRAdmin":
      return "HR administrator";
    case "PlatformAdmin":
      return "Platform administrator";
    case "Manager":
      return "Manager";
    case "Employee":
      return "Employee";
    default:
      return role?.trim() ? role.replace(/([a-z])([A-Z])/g, "$1 $2") : fallback;
  }
}

function getIssueGroups(issues: DraftSetupIssueDto[]) {
  return Object.entries(ISSUE_CATEGORY_LABELS)
    .map(([category, label]) => ({
      category: category as DraftSetupIssueCategory,
      label,
      issues: issues.filter((issue) => issue.category === category),
    }))
    .filter((group) => group.issues.length > 0);
}

function getActivityCopy(activity: TenantSetupActivityDto) {
  switch (activity.activityType) {
    case "approved":
      return {
        title: "Draft approved",
        description: `${activity.actorFullName} approved the structure`,
      };
    case "published":
      return {
        title: "Structure published",
        description: `${activity.actorFullName} published the structure to live`,
      };
    case "completed":
      return {
        title: "Setup completed",
        description: `${activity.actorFullName} completed setup`,
      };
    default:
      return {
        title: "Draft reopened",
        description: `${activity.actorFullName} reopened the structure`,
      };
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.errors.join(", ");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred.";
}

export default function SetupPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { tenantId } = useTenantContext();
  const dashboardHref = buildTenantContextHref("/", tenantId);
  const draftStructureHref = buildTenantContextHref(
    "/setup/draft-structure",
    tenantId
  );
  const isTenantContextReadOnly = !!tenantId;
  const canAccess = canAccessCoreSetup(user) || isTenantContextReadOnly;
  const [localError, setLocalError] = useState<string | null>(null);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);

  const {
    setupState,
    setupError,
    isSetupStateLoading: isSetupLoading,
    refreshSetupAccess,
  } = useCoreSetupAccess();
  const setupStarted = !!setupState && !setupState.canStartSetup;
  const pageTitle = setupStarted ? "Setup summary" : "Setup";
  const {
    data: readiness,
    error: readinessError,
    isLoading: isReadinessLoading,
    refetch: refetchReadiness,
  } = useSetupReadiness(canAccess && setupStarted);
  const approveStructure = useApproveStructure();
  const publishStructure = usePublishStructure({
    onSuccess: () => {
      setPublishDialogOpen(false);
      setLocalError(null);
    },
  });
  const reopenStructure = useReopenStructure();

  if (!canAccess) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          title={pageTitle}
          description="Tenant HR administrators manage setup."
        />
        <EmptyState
          icon={ClipboardList}
          title="Setup is not available for this role"
          description="Contact a tenant HR administrator."
        />
      </div>
    );
  }

  if (isSetupLoading && !setupState) {
    return <SetupPageSkeleton />;
  }

  if (setupError && !setupState) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          title={pageTitle}
          description="The review page is available after the setup state loads."
        />
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Setup could not be loaded</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{setupError.message}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshSetupAccess()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!setupState) {
    return <SetupPageSkeleton />;
  }

  const phase = setupState.currentPhase;
  const isCoreUnlocked = isSetupCompletePhase(setupState.currentPhase);
  const isGoverned = phase === "structurallyGoverned";
  const isActivated = phase === "activated";
  const completedMilestones = getCompletedMilestoneCount(setupState);
  const progressValue = Math.round(
    (completedMilestones / Math.max(SETUP_STEPS.length, 1)) * 100
  );
  const hasDraftUnits = (readiness?.totalUnitCount ?? 0) > 0;
  const blockingIssueCount = hasDraftUnits
    ? (readiness?.blockingIssueCount ?? 0)
    : 0;
  const warningCount = hasDraftUnits ? (readiness?.warningCount ?? 0) : 0;
  const hasBlockingIssues = hasDraftUnits && blockingIssueCount > 0;
  const hasWarnings = hasDraftUnits && warningCount > 0;
  const shouldEmphasizeReadiness =
    !!readinessError || hasBlockingIssues || hasWarnings;
  const isReadyForApproval = !!readiness?.isReadyForApproval;
  const heroCopy = getHeroCopy({
    phase,
    hasDraftUnits,
    isReadyForApproval,
    blockingIssueCount,
  });
  const pageError = localError ?? null;
  const pageDescription = getHeaderDescription({
    phase,
    hasDraftUnits,
    isReadyForApproval,
    blockingIssueCount,
  });

  const handleApprove = async () => {
    if (setupState.version == null) {
      setLocalError("The latest setup version is required before approval.");
      return;
    }

    setLocalError(null);

    try {
      await approveStructure.mutateAsync({
        expectedVersion: setupState.version,
      });
      await Promise.allSettled([refreshSetupAccess(), refetchReadiness()]);
    } catch (error) {
      setLocalError(getErrorMessage(error));
    }
  };

  const handlePublish = async () => {
    if (setupState.version == null) {
      setLocalError("The latest setup version is required before publishing.");
      return;
    }

    setLocalError(null);

    try {
      await publishStructure.mutateAsync({
        expectedVersion: setupState.version,
      });
      await Promise.allSettled([refreshSetupAccess(), refetchReadiness()]);
    } catch (error) {
      setLocalError(getErrorMessage(error));
    }
  };

  const handleReopen = async () => {
    if (setupState.version == null) {
      setLocalError("The latest setup version is required before reopening.");
      return;
    }

    setLocalError(null);

    try {
      await reopenStructure.mutateAsync({
        expectedVersion: setupState.version,
      });
      await Promise.allSettled([refreshSetupAccess(), refetchReadiness()]);
    } catch (error) {
      setLocalError(getErrorMessage(error));
    }
  };

  const isDraftEmpty = !!readiness && !hasDraftUnits;
  const approvalDisabled =
    setupState?.currentPhase !== "activated" ||
    isReadinessLoading ||
    !readiness?.isReadyForApproval ||
    approveStructure.isLoading;
  const publishDisabled =
    setupState?.currentPhase !== "structurallyGoverned" ||
    isReadinessLoading ||
    !readiness?.isReadyForApproval ||
    publishStructure.isLoading;
  const reopenDisabled =
    setupState?.currentPhase !== "structurallyGoverned" ||
    reopenStructure.isLoading;
  const metricsSummary = getMetricsSummary({
    phase,
    hasDraftUnits,
    blockingIssueCount,
    warningCount,
  });
  const approvalDisabledHint =
    isActivated && !isTenantContextReadOnly && approvalDisabled
      ? getApprovalDisabledHint({
          hasDraftUnits,
          blockingIssueCount,
          isReadyForApproval,
          isReadinessLoading,
        })
      : null;
  const publishDisabledHint =
    isGoverned && !isTenantContextReadOnly && publishDisabled
      ? getPublishDisabledHint({
          blockingIssueCount,
          isReadyForApproval,
          isReadinessLoading,
        })
      : null;
  const recentActivitiesPreview = setupState.recentActivities.slice(0, 4);
  const remainingActivityCount = Math.max(
    setupState.recentActivities.length - recentActivitiesPreview.length,
    0
  );
  const statusMeta = isCoreUnlocked
    ? `Published ${formatTimestamp(
        phase === "operational"
          ? setupState.operationalAt
          : setupState.structurallyPublishedAt
      )}`
    : setupState.approvedAt
      ? `${setupState.approvedByFullName ?? "Approval recorded"} • ${formatTimestamp(setupState.approvedAt)}`
      : null;

  return (
    <div className="flex flex-col gap-5 p-6">
      <PageHeader title="Setup" description={pageDescription} />

      {pageError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Setup could not be updated</AlertTitle>
          <AlertDescription>{pageError}</AlertDescription>
        </Alert>
      ) : null}

      <SetupMilestoneStrip data={setupState} />

      <Card className="overflow-hidden">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
          <div className="space-y-5 border-b p-6 xl:border-r xl:border-b-0">
            <div className="flex flex-wrap items-center gap-2">
              <SetupStatusBadge status={setupState.currentPhase} />
              {isGoverned ? <Badge variant="outline">Locked</Badge> : null}
              {isCoreUnlocked ? (
                <Badge variant="secondary">Published structure</Badge>
              ) : null}
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">
                {heroCopy.title}
              </h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                {heroCopy.description}
              </p>
              {statusMeta ? (
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {setupState.isApprovedInPlatformAssistMode ? (
                    <Badge variant="outline">Assisted</Badge>
                  ) : null}
                  <span>{statusMeta}</span>
                  {setupState.approvedAt && !isCoreUnlocked ? (
                    <span>{formatRoleLabel(setupState.approvedByRole)}</span>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {!setupStarted && !isTenantContextReadOnly ? (
                <Button onClick={() => router.push(SETUP_DRAFT_ENTRY_PATH)}>
                  Open draft workspace
                </Button>
              ) : null}
              {isActivated ? (
                <>
                  {!isTenantContextReadOnly && isReadyForApproval ? (
                    <Button
                      onClick={() => {
                        void handleApprove();
                      }}
                      disabled={approvalDisabled}
                    >
                      Approve structure
                    </Button>
                  ) : null}
                  {!isTenantContextReadOnly ? (
                    <Button
                      variant={isReadyForApproval ? "outline" : "default"}
                      onClick={() => router.push(draftStructureHref)}
                    >
                      Open draft workspace
                    </Button>
                  ) : null}
                  {!isTenantContextReadOnly && !isReadyForApproval ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        void handleApprove();
                      }}
                      disabled={approvalDisabled}
                    >
                      Approve structure
                    </Button>
                  ) : null}
                </>
              ) : null}
              {isGoverned ? (
                <>
                  {!isTenantContextReadOnly ? (
                    <Button
                      onClick={() => setPublishDialogOpen(true)}
                      disabled={publishDisabled}
                    >
                      Publish structure
                    </Button>
                  ) : null}
                  {!isTenantContextReadOnly ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        void handleReopen();
                      }}
                      disabled={reopenDisabled}
                    >
                      Reopen draft
                    </Button>
                  ) : null}
                  {!isTenantContextReadOnly ? (
                    <Button
                      variant="outline"
                      onClick={() => router.push(draftStructureHref)}
                    >
                      View draft workspace
                    </Button>
                  ) : null}
                </>
              ) : null}
              {isCoreUnlocked ? (
                <>
                  <Button onClick={() => router.push(dashboardHref)}>
                    Open dashboard
                  </Button>
                  {!isTenantContextReadOnly ? (
                    <Button
                      variant="outline"
                      onClick={() => router.push(draftStructureHref)}
                    >
                      View published structure
                    </Button>
                  ) : null}
                </>
              ) : null}
            </div>

            {approvalDisabledHint ? (
              <p className="text-sm text-muted-foreground">
                {approvalDisabledHint}
              </p>
            ) : null}
            {publishDisabledHint ? (
              <p className="text-sm text-muted-foreground">
                {publishDisabledHint}
              </p>
            ) : null}
            {isGoverned ? (
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <LockKeyhole className="size-4" />
                Locked until reopened.
              </div>
            ) : null}
          </div>

          <div className="space-y-4 bg-muted/10 p-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricTile
                label="Progress"
                value={`${completedMilestones}/${SETUP_STEPS.length}`}
                hint={`${progressValue}% complete`}
              />
              <MetricTile
                label="Units"
                value={
                  isReadinessLoading && !readiness
                    ? "..."
                    : String(readiness?.totalUnitCount ?? 0)
                }
                hint={
                  hasDraftUnits
                    ? `Top level ${readiness?.rootUnitCount ?? 0}`
                    : "Draft not started"
                }
              />
              <MetricTile
                label="Readiness"
                value={
                  isReadinessLoading && !readiness
                    ? "..."
                    : !hasDraftUnits
                      ? "Waiting"
                      : blockingIssueCount > 0
                        ? `${blockingIssueCount} blocker${blockingIssueCount === 1 ? "" : "s"}`
                        : isCoreUnlocked
                          ? "Published"
                          : isGoverned
                            ? "Ready"
                            : warningCount > 0
                              ? `${warningCount} warning${warningCount === 1 ? "" : "s"}`
                              : "Ready"
                }
                hint={
                  !hasDraftUnits
                    ? "No checks yet"
                    : blockingIssueCount > 0
                      ? "Resolve blockers in Draft Structure"
                      : isCoreUnlocked
                        ? "Live structure is in place"
                        : isGoverned
                          ? "Ready to publish"
                          : warningCount > 0
                            ? "Review warnings before approval"
                            : "Ready for approval"
                }
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <span>Setup progress</span>
                <span>{progressValue}%</span>
              </div>
              <Progress value={progressValue} className="h-2" />
              <p className="text-sm text-muted-foreground">{metricsSummary}</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Card>
          <CardHeader className={shouldEmphasizeReadiness ? "pb-3" : "pb-0"}>
            <CardTitle>Readiness</CardTitle>
          </CardHeader>
          <CardContent
            className={shouldEmphasizeReadiness ? "space-y-4" : "pt-4"}
          >
            {readinessError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Readiness could not be loaded</AlertTitle>
                <AlertDescription className="flex items-center justify-between gap-4">
                  <span>{readinessError.message}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchReadiness()}
                  >
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            ) : setupStarted && isReadinessLoading && !readiness ? (
              <ReadinessSkeleton />
            ) : readiness ? (
              <>
                {shouldEmphasizeReadiness ? (
                  <>
                    <ReviewSummaryCard
                      setupState={setupState}
                      hasDraftUnits={hasDraftUnits}
                      isReadyForApproval={isReadyForApproval}
                      blockingIssueCount={readiness.blockingIssueCount}
                      warningCount={readiness.warningCount}
                    >
                      {isDraftEmpty && !isTenantContextReadOnly ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(draftStructureHref)}
                        >
                          Open draft workspace
                        </Button>
                      ) : null}
                    </ReviewSummaryCard>

                    {hasBlockingIssues ? (
                      <IssueSection
                        title="Blocking issues"
                        issues={readiness.blockingIssues}
                      />
                    ) : null}

                    {hasWarnings ? (
                      <IssueSection
                        title="Warnings"
                        issues={readiness.warnings}
                      />
                    ) : null}
                  </>
                ) : (
                  <CompactReadinessRow
                    phase={phase}
                    hasDraftUnits={hasDraftUnits}
                    isReadyForApproval={isReadyForApproval}
                    onOpenDraft={
                      !isTenantContextReadOnly
                        ? () => router.push(draftStructureHref)
                        : undefined
                    }
                  />
                )}
              </>
            ) : (
              <CompactReadinessRow
                phase={phase}
                hasDraftUnits={false}
                isReadyForApproval={false}
                onOpenDraft={
                  !isTenantContextReadOnly
                    ? () => router.push(draftStructureHref)
                    : undefined
                }
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {setupState.recentActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <div className="space-y-3">
                {recentActivitiesPreview.map((activity, index) => {
                  const activityCopy = getActivityCopy(activity);

                  return (
                    <div key={activity.id} className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <History className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{activityCopy.title}</p>
                            {activity.isPlatformAssisted ? (
                              <Badge variant="outline">Assisted</Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {activityCopy.description}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatRoleLabel(activity.actorRole, "Activity")} •{" "}
                            {formatTimestamp(activity.occurredAt)}
                          </p>
                        </div>
                      </div>
                      {index < recentActivitiesPreview.length - 1 ? (
                        <Separator />
                      ) : null}
                    </div>
                  );
                })}
                {remainingActivityCount > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    +{remainingActivityCount} more recent update
                    {remainingActivityCount === 1 ? "" : "s"}
                  </p>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <AlertTriangle className="size-5 text-amber-700" />
            </AlertDialogMedia>
            <AlertDialogTitle>Publish structure?</AlertDialogTitle>
            <AlertDialogDescription>
              This makes the approved structure live and unlocks Core
              workspaces. Existing live units will be replaced.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={publishStructure.isLoading}>
              Keep reviewing
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handlePublish();
              }}
              disabled={publishStructure.isLoading}
            >
              Publish structure
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MetricTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-background/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold tracking-tight">{value}</p>
      {hint ? (
        <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function SetupMilestoneStrip({
  data,
}: {
  data: TenantSetupStateDto | undefined;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-3">
      {SETUP_STEPS.map((step) => (
        <SetupMilestoneCard
          key={step.key}
          step={step}
          state={getStepState(step.key, data)}
        />
      ))}
    </div>
  );
}

function ReviewSummaryCard({
  setupState,
  hasDraftUnits,
  isReadyForApproval,
  blockingIssueCount,
  warningCount,
  children,
}: {
  setupState: TenantSetupStateDto;
  hasDraftUnits: boolean;
  isReadyForApproval: boolean;
  blockingIssueCount: number;
  warningCount: number;
  children?: ReactNode;
}) {
  const isGoverned = setupState.currentPhase === "structurallyGoverned";
  const isPublished = setupState.currentPhase === "structurallyPublished";
  const isOperational = setupState.currentPhase === "operational";
  const isComplete = isPublished || isOperational;

  const statusLabel =
    !hasDraftUnits && !isGoverned && !isComplete
      ? "Draft empty"
      : isComplete
        ? "Published"
        : isGoverned && !isReadyForApproval
          ? "Approved"
          : isGoverned
            ? "Approved"
            : isReadyForApproval
              ? "Ready"
              : "Needs work";

  const summaryText =
    !hasDraftUnits && !isGoverned && !isComplete
      ? "Add the first unit or import a template to start readiness checks."
      : isComplete
        ? "The live structure is published and available across Core."
        : isGoverned && !isReadyForApproval
          ? "Reopen the draft only if changes are still required before publish."
          : isGoverned
            ? "Publish when you are ready to make this structure live."
            : isReadyForApproval
              ? "Approve the structure to lock it for publish."
              : "Resolve blockers in Draft Structure, then return here.";

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-muted/15 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              !hasDraftUnits || isComplete || isGoverned || isReadyForApproval
                ? "secondary"
                : "destructive"
            }
          >
            {statusLabel}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {hasDraftUnits
              ? `${blockingIssueCount} blocker${blockingIssueCount === 1 ? "" : "s"}${warningCount > 0 ? ` • ${warningCount} warning${warningCount === 1 ? "" : "s"}` : ""}`
              : "Not checked yet"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{summaryText}</p>
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}

function CompactReadinessRow({
  phase,
  hasDraftUnits,
  isReadyForApproval,
  onOpenDraft,
}: {
  phase: CoreSetupPhase;
  hasDraftUnits: boolean;
  isReadyForApproval: boolean;
  onOpenDraft?: () => void;
}) {
  const label = !hasDraftUnits
    ? "Draft empty"
    : isSetupCompletePhase(phase)
      ? "Published"
      : phase === "structurallyGoverned"
        ? "Approved"
        : isReadyForApproval
          ? "Ready to approve"
          : "In progress";
  const summary = !hasDraftUnits
    ? "Add the first unit or import a template."
    : isSetupCompletePhase(phase)
      ? "The live structure is in place."
      : phase === "structurallyGoverned"
        ? "Ready to publish."
        : isReadyForApproval
          ? "Approve when ready."
          : "Continue in Draft Structure.";

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-muted/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{label}</Badge>
        <p className="text-sm text-muted-foreground">{summary}</p>
      </div>
      {onOpenDraft ? (
        <Button variant="outline" size="sm" onClick={onOpenDraft}>
          Open draft workspace
        </Button>
      ) : null}
    </div>
  );
}

function IssueSection({
  title,
  issues,
}: {
  title: string;
  issues: DraftSetupIssueDto[];
}) {
  const groups = getIssueGroups(issues);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">{title}</p>
        <Badge variant="outline">{issues.length}</Badge>
      </div>

      <div className="space-y-3">
        {groups.map((group) => (
          <div
            key={group.category}
            className="rounded-xl border bg-muted/20 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">{group.label}</p>
              <Badge variant="outline">{group.issues.length}</Badge>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {group.issues.map((issue, index) => (
                <li key={`${issue.code}-${issue.unitId ?? "none"}-${index}`}>
                  {issue.message}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function SetupMilestoneCard({
  step,
  state,
}: {
  step: (typeof SETUP_STEPS)[number];
  state: "complete" | "current" | "upcoming";
}) {
  const Icon = step.icon;
  const stateLabel =
    state === "complete" ? "Done" : state === "current" ? "Current" : "Later";
  const cardClass =
    state === "current"
      ? "border-primary/30 bg-primary/5"
      : state === "complete"
        ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20"
        : "bg-background";

  return (
    <div
      className={`flex h-full items-center justify-between gap-3 rounded-xl border p-3 ${cardClass}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Icon className="size-4" />
          </div>
          <p className="font-medium">{step.title}</p>
        </div>
      </div>
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {stateLabel}
      </span>
    </div>
  );
}

function SetupPageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Organization Setup"
        description="Loading the review surface..."
      />
      <Card>
        <CardContent className="grid gap-4 p-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-6 w-60" />
            <Skeleton className="h-4 w-full max-w-2xl" />
            <Skeleton className="h-4 w-full max-w-xl" />
            <div className="grid gap-3 md:grid-cols-3">
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Skeleton className="h-104 rounded-xl" />
        <Skeleton className="h-104 rounded-xl" />
      </div>
    </div>
  );
}

function ReadinessSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
    </div>
  );
}
