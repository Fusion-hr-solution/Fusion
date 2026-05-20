"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SetupStatusBadge } from "./setup-status-badge";
import {
  useActivateSetup,
  useApproveStructure,
  usePublishStructure,
  useReopenStructure,
  useSetupReadiness,
} from "./use-setup";

type SetupMilestoneKey = "activated" | "structurallyGoverned" | "operational";

const SETUP_STEPS: Array<{
  key: SetupMilestoneKey;
  title: string;
  description: string;
  icon: typeof Flag;
}> = [
  {
    key: "activated",
    title: "Setup started",
    description: "The draft workspace is open and isolated from live.",
    icon: Flag,
  },
  {
    key: "structurallyGoverned",
    title: "Structure approved",
    description: "The draft is reviewed and locked for the next step.",
    icon: ShieldCheck,
  },
  {
    key: "operational",
    title: "Setup complete",
    description: "The approved structure is live.",
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

function getReviewCopy(phase: CoreSetupPhase) {
  switch (phase) {
    case "activated":
      return {
        title: "Review the draft",
        description: "Approve it when the structure is ready.",
      };
    case "structurallyGoverned":
      return {
        title: "The draft is approved",
        description: "Publish it to make the structure live.",
      };
    case "structurallyPublished":
      return {
        title: "Setup is complete",
        description: "The live structure is in place.",
      };
    case "operational":
      return {
        title: "Setup is complete",
        description: "The live structure is in place.",
      };
    default:
      return {
        title: "Start setup",
        description: "Open the draft workspace to begin.",
      };
  }
}

function getReadinessReviewDescription(phase: CoreSetupPhase) {
  switch (phase) {
    case "structurallyGoverned":
      return "Clear blockers before publishing.";
    case "structurallyPublished":
    case "operational":
      return "Final review results.";
    default:
      return "Clear blockers before approval.";
  }
}

function getBlockingIssueHint(
  phase: CoreSetupPhase,
  hasDraftUnits: boolean,
  blockingIssueCount: number
) {
  if (!hasDraftUnits) {
    return "Shown after the draft takes shape";
  }

  if (blockingIssueCount > 0) {
    return phase === "structurallyGoverned"
      ? "Reopen to clear before publish"
      : "Must be cleared first";
  }

  if (isSetupCompletePhase(phase)) {
    return "Checks passed before completion";
  }

  return phase === "structurallyGoverned"
    ? "Ready to publish"
    : "Ready for approval";
}

function getWarningHint(
  phase: CoreSetupPhase,
  hasDraftUnits: boolean,
  warningCount: number
) {
  if (!hasDraftUnits) {
    return "Shown after the draft takes shape";
  }

  if (warningCount > 0) {
    return phase === "structurallyGoverned"
      ? "Review before publish"
      : "Review before approval";
  }

  if (isSetupCompletePhase(phase)) {
    return "No remaining warnings";
  }

  return "No open warnings";
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
  const activateSetup = useActivateSetup();
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
          description="Setup is available to HR administrators."
        />
        <EmptyState
          icon={ClipboardList}
          title="Setup is not available for this role"
          description="Ask an HR administrator to manage setup."
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
        <PageHeader title={pageTitle} description="Load setup to continue." />
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

  const isCoreUnlocked = isSetupCompletePhase(setupState.currentPhase);
  const completedMilestones = getCompletedMilestoneCount(setupState);
  const progressValue = Math.round(
    (completedMilestones / Math.max(SETUP_STEPS.length, 1)) * 100
  );
  const reviewCopy = getReviewCopy(setupState?.currentPhase ?? "notStarted");
  const pageError = localError ?? null;
  const pageDescription = isCoreUnlocked
    ? "Review the live structure and setup record."
    : setupState.currentPhase === "structurallyGoverned"
      ? "Publish the approved draft when it is ready."
      : "Check the draft and move it to approval.";

  const handleStartSetup = async () => {
    setLocalError(null);

    try {
      await activateSetup.mutateAsync();
      router.replace("/setup/draft-structure");
    } catch (error) {
      setLocalError(getErrorMessage(error));
    }
  };

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
    } catch (error) {
      setLocalError(getErrorMessage(error));
    }
  };

  if (setupState?.canStartSetup) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          title="Setup"
          description="Start in draft, review it, then publish when ready."
        />

        {pageError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Setup could not be updated</AlertTitle>
            <AlertDescription>{pageError}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="overflow-hidden">
          <div className="grid gap-0 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="border-b p-6 xl:border-r xl:border-b-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Setup
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <SetupStatusBadge status="notStarted" />
                <span className="text-sm text-muted-foreground">
                  0% complete
                </span>
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                Open the draft workspace
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Build the structure in draft first. The live structure stays
                untouched until you publish it.
              </p>
            </div>

            <div className="space-y-6 p-6">
              <MetricTile
                label="Progress"
                value={`0/${SETUP_STEPS.length}`}
                hint="Setup milestones"
              />
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-sm font-medium">Next</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <li>1. Build the draft structure.</li>
                  <li>2. Approve it when it is ready.</li>
                  <li>3. Publish it to make the structure live.</li>
                </ul>
              </div>
              {!isTenantContextReadOnly ? (
                <Button
                  className="w-full"
                  onClick={() => {
                    void handleStartSetup();
                  }}
                  disabled={activateSetup.isLoading}
                >
                  Start organization setup
                  <ArrowRight className="size-4" />
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Setup actions are not available in read-only view.
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const hasDraftUnits = (readiness?.totalUnitCount ?? 0) > 0;
  const isDraftEmpty = !!readiness && !hasDraftUnits;
  const blockingIssueCount = hasDraftUnits
    ? (readiness?.blockingIssueCount ?? 0)
    : 0;
  const warningCount = hasDraftUnits ? (readiness?.warningCount ?? 0) : 0;
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
  const showRecentActivity =
    setupState.recentActivities.length > 0 || isCoreUnlocked;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title={pageTitle} description={pageDescription} />

      {pageError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Setup could not be updated</AlertTitle>
          <AlertDescription>{pageError}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="overflow-hidden">
        <div className="grid gap-0 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="border-b p-6 xl:border-r xl:border-b-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Setup
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SetupStatusBadge status={setupState.currentPhase} />
              <span className="text-sm text-muted-foreground">
                {progressValue}% complete
              </span>
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              {reviewCopy.title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {reviewCopy.description}
            </p>

            {isCoreUnlocked ? (
              <div className="mt-6 rounded-xl border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">Setup complete</Badge>
                  <Badge variant="outline">Live structure ready</Badge>
                </div>
                <p className="mt-3 text-sm font-medium">
                  Completed{" "}
                  {formatTimestamp(
                    setupState.currentPhase === "operational"
                      ? setupState.operationalAt
                      : setupState.structurallyPublishedAt
                  )}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The live structure is ready.
                </p>
              </div>
            ) : setupState.approvedAt ? (
              <div className="mt-6 rounded-xl border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">Approved</Badge>
                  {setupState.isApprovedInPlatformAssistMode ? (
                    <Badge variant="outline">Assisted</Badge>
                  ) : null}
                </div>
                <p className="mt-3 text-sm font-medium">
                  {setupState.approvedByFullName ?? "Approval recorded"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatRoleLabel(setupState.approvedByRole)} •{" "}
                  {formatTimestamp(setupState.approvedAt)}
                </p>
              </div>
            ) : (
              <div className="mt-6 rounded-xl border bg-muted/20 p-4">
                <div className="flex items-start gap-3">
                  <LockKeyhole className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Approval lock</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      The draft stays read-only until it is reopened.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              {setupState.currentPhase === "activated" ? (
                <>
                  {!isTenantContextReadOnly ? (
                    <Button onClick={() => router.push(draftStructureHref)}>
                      Open draft workspace
                    </Button>
                  ) : null}
                  {!isTenantContextReadOnly ? (
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
              {setupState.currentPhase === "structurallyGoverned" ? (
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
          </div>

          <div className="grid gap-4 p-6 sm:grid-cols-2">
            <MetricTile
              label="Progress"
              value={`${completedMilestones}/${SETUP_STEPS.length}`}
              hint="Setup milestones"
            />
            <MetricTile
              label="Units in draft"
              value={
                isReadinessLoading && !readiness
                  ? "..."
                  : String(readiness?.totalUnitCount ?? 0)
              }
              hint={`Top-level units: ${readiness?.rootUnitCount ?? 0}`}
            />
            <MetricTile
              label="Blocking issues"
              value={
                isReadinessLoading && !readiness
                  ? "..."
                  : String(blockingIssueCount)
              }
              hint={getBlockingIssueHint(
                setupState.currentPhase,
                hasDraftUnits,
                blockingIssueCount
              )}
            />
            <MetricTile
              label="Warnings"
              value={
                isReadinessLoading && !readiness ? "..." : String(warningCount)
              }
              hint={getWarningHint(
                setupState.currentPhase,
                hasDraftUnits,
                warningCount
              )}
            />
          </div>
        </div>
      </Card>

      <div
        className={`grid gap-4${
          showRecentActivity
            ? " xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]"
            : ""
        }`}
      >
        <Card>
          <CardHeader>
            <CardTitle>Readiness review</CardTitle>
            <CardDescription>
              {getReadinessReviewDescription(setupState.currentPhase)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
            ) : isReadinessLoading && !readiness ? (
              <ReadinessSkeleton />
            ) : readiness ? (
              <>
                <ReviewSummaryCard
                  setupState={setupState}
                  hasDraftUnits={hasDraftUnits}
                  isReadyForApproval={readiness.isReadyForApproval}
                  blockingIssueCount={readiness.blockingIssueCount}
                  warningCount={readiness.warningCount}
                />

                {hasDraftUnits && readiness.blockingIssues.length > 0 ? (
                  <IssueSection
                    title="Blocking issues"
                    description="Clear these first."
                    issues={readiness.blockingIssues}
                  />
                ) : null}

                {hasDraftUnits && readiness.warnings.length > 0 ? (
                  <IssueSection
                    title="Warnings"
                    description="Review these before you move on."
                    issues={readiness.warnings}
                  />
                ) : null}

                {isDraftEmpty ? (
                  <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                    Add the first unit or import the structure template before
                    approval checks begin.
                  </div>
                ) : null}
              </>
            ) : null}
          </CardContent>
        </Card>

        {showRecentActivity ? (
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>
                {isCoreUnlocked
                  ? "Setup activity stays here as the final record."
                  : "Approval, publish, reopen, and completion events."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {setupState.recentActivities.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                  No setup activity recorded yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {setupState.recentActivities.map((activity, index) => {
                    const activityCopy = getActivityCopy(activity);

                    return (
                      <div key={activity.id} className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <History className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">
                                {activityCopy.title}
                              </p>
                              {activity.isPlatformAssisted ? (
                                <Badge variant="outline">Assisted</Badge>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {activityCopy.description}
                            </p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {formatRoleLabel(activity.actorRole, "Activity")}{" "}
                              • {formatTimestamp(activity.occurredAt)}
                            </p>
                          </div>
                        </div>
                        {index < setupState.recentActivities.length - 1 ? (
                          <Separator />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <AlertDialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <AlertTriangle className="size-5 text-amber-700" />
            </AlertDialogMedia>
            <AlertDialogTitle>Publish this structure to live?</AlertDialogTitle>
            <AlertDialogDescription>
              This publishes the approved draft to your live organization and
              completes setup. Existing live units will be replaced in one step.
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
  hint: string;
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

function ReviewSummaryCard({
  setupState,
  hasDraftUnits,
  isReadyForApproval,
  blockingIssueCount,
  warningCount,
}: {
  setupState: TenantSetupStateDto;
  hasDraftUnits: boolean;
  isReadyForApproval: boolean;
  blockingIssueCount: number;
  warningCount: number;
}) {
  const isGoverned = setupState.currentPhase === "structurallyGoverned";
  const isPublished = setupState.currentPhase === "structurallyPublished";
  const isOperational = setupState.currentPhase === "operational";
  const isComplete = isPublished || isOperational;

  const statusLabel =
    !hasDraftUnits && !isGoverned && !isComplete
      ? "Draft not started"
      : isComplete
        ? "Setup complete"
        : isGoverned && !isReadyForApproval
          ? "Needs changes before publish"
          : isGoverned
            ? "Ready to publish"
            : isReadyForApproval
              ? "Ready for approval"
              : "Needs attention";

  const summaryText =
    !hasDraftUnits && !isGoverned && !isComplete
      ? "Add the first unit or import the template before review starts."
      : isComplete
        ? "The live structure is in place."
        : isGoverned && !isReadyForApproval
          ? "Reopen the draft and clear the remaining issues."
          : isGoverned
            ? "The approved draft is ready to publish."
            : isReadyForApproval
              ? "The draft is ready for approval."
              : "Keep working in the draft until the blockers are cleared.";

  return (
    <div className="rounded-xl border bg-muted/20 p-4">
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
            ? `${blockingIssueCount} blocking issue${blockingIssueCount === 1 ? "" : "s"}${warningCount > 0 ? ` • ${warningCount} warning${warningCount === 1 ? "" : "s"}` : ""}`
            : "No draft units yet"}
        </span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{summaryText}</p>
    </div>
  );
}

function IssueSection({
  title,
  description,
  issues,
}: {
  title: string;
  description: string;
  issues: DraftSetupIssueDto[];
}) {
  const groups = getIssueGroups(issues);

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
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
