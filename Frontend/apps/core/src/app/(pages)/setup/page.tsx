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
import { Progress } from "@/components/ui/progress";
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

function getReviewCopy(phase: CoreSetupPhase) {
  switch (phase) {
    case "activated":
      return {
        title: "Review the draft and approve when ready",
        description: "Approval locks the draft until it is reopened.",
      };
    case "structurallyGoverned":
      return {
        title: "The structure is approved and ready to publish",
        description:
          "Publishing moves the locked draft into live and completes setup.",
      };
    case "structurallyPublished":
      return {
        title: "Setup is complete",
        description:
          "The live structure is in place. This page stays as the summary and activity record.",
      };
    case "operational":
      return {
        title: "Setup is complete",
        description:
          "The live structure is in place. Use this page as the summary and activity record.",
      };
    default:
      return {
        title: "Start setup to open the draft workspace",
        description: "Create the first draft before review can begin.",
      };
  }
}

function getReadinessReviewDescription(phase: CoreSetupPhase) {
  switch (phase) {
    case "structurallyGoverned":
      return "Publishing stays blocked until the locked draft has no blockers.";
    case "structurallyPublished":
    case "operational":
      return "These results remain as the final review record.";
    default:
      return "Approval and publish stay blocked until the draft has no blockers.";
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

function getCleanDraftMessage(phase: CoreSetupPhase) {
  switch (phase) {
    case "structurallyGoverned":
      return "The draft is clean and locked. Publish it when ready, or reopen it for more changes.";
    case "structurallyPublished":
    case "operational":
      return "The final review passed and the live structure is in place.";
    default:
      return "The draft is clean. You can approve it when ready.";
  }
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
  const canAccess = canAccessCoreSetup(user);
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
          description="Core setup is limited to tenant HR administrators."
        />
        <EmptyState
          icon={ClipboardList}
          title="Setup is not available for this role"
          description="Ask a tenant HR administrator to manage setup."
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

  const isCoreUnlocked = isSetupCompletePhase(setupState.currentPhase);
  const completedMilestones = getCompletedMilestoneCount(setupState);
  const progressValue = Math.round(
    (completedMilestones / Math.max(SETUP_STEPS.length, 1)) * 100
  );
  const reviewCopy = getReviewCopy(setupState?.currentPhase ?? "notStarted");
  const pageError = localError ?? null;
  const pageDescription = isCoreUnlocked
    ? "Review the completion summary, published structure, and setup history."
    : setupState.currentPhase === "structurallyGoverned"
      ? "Review the approved draft and publish it when ready."
      : "Review draft readiness and move the structure through approval.";

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
          title="Organization Setup"
          description="Start with the draft structure. Approve it from there or from this review page when ready."
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
                First step
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
                Build the organization structure in a protected draft first. The
                live structure stays untouched until later steps are complete.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <SummaryTile
                  title="Build the first draft"
                  description="Add top-level units, place child units, and shape the hierarchy in one workspace."
                />
                <SummaryTile
                  title="Import when useful"
                  description="Use the template if the structure already exists elsewhere."
                />
                <SummaryTile
                  title="Review before lock"
                  description="Approve from the draft flow or from this page when ready."
                />
              </div>
            </div>

            <div className="space-y-6 p-6">
              <MetricTile
                label="Progress"
                value={`0/${SETUP_STEPS.length}`}
                hint="Setup milestones"
              />
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-sm font-medium">What happens next</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Starting setup opens the draft structure workspace.
                </p>
              </div>
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
            </div>
          </div>
        </Card>

        <RoadmapCard data={setupState} />
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
              Governance review
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
                  The live structure is in place. This page stays as the summary
                  and activity record.
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
                      After approval, the draft becomes read-only until it is
                      reopened here.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              {setupState.currentPhase === "activated" ? (
                <>
                  <Button onClick={() => router.push("/setup/draft-structure")}>
                    Open draft workspace
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      void handleApprove();
                    }}
                    disabled={approvalDisabled}
                  >
                    Approve structure
                  </Button>
                </>
              ) : null}
              {setupState.currentPhase === "structurallyGoverned" ? (
                <>
                  <Button
                    onClick={() => setPublishDialogOpen(true)}
                    disabled={publishDisabled}
                  >
                    Publish structure
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      void handleReopen();
                    }}
                    disabled={reopenDisabled}
                  >
                    Reopen draft
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => router.push("/setup/draft-structure")}
                  >
                    View draft workspace
                  </Button>
                </>
              ) : null}
              {isCoreUnlocked ? (
                <>
                  <Button onClick={() => router.push("/")}>Open dashboard</Button>
                  <Button
                    variant="outline"
                    onClick={() => router.push("/setup/draft-structure")}
                  >
                    View published structure
                  </Button>
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
            <div className="sm:col-span-2 space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Setup progress</span>
                <span>{progressValue}%</span>
              </div>
              <Progress value={progressValue} />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
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
                    description="Clear these before approval."
                    issues={readiness.blockingIssues}
                  />
                ) : null}

                {hasDraftUnits && readiness.warnings.length > 0 ? (
                  <IssueSection
                    title="Warnings"
                    description="These do not block approval, but they should be reviewed."
                    issues={readiness.warnings}
                  />
                ) : null}

                {isDraftEmpty ? (
                  <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                    Add the first unit or import the structure template before
                    approval checks begin.
                  </div>
                ) : readiness.blockingIssues.length === 0 &&
                  readiness.warnings.length === 0 ? (
                  <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                    {getCleanDraftMessage(setupState.currentPhase)}
                  </div>
                ) : null}
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>
              {isCoreUnlocked
                ? "This history remains as the completion record for setup."
                : "Approval, publish, reopen, and completion events appear here."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {setupState.recentActivities.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                No review activity has been recorded yet.
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
                            <p className="font-medium">{activityCopy.title}</p>
                            {activity.isPlatformAssisted ? (
                              <Badge variant="outline">Assisted</Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {activityCopy.description}
                          </p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {formatRoleLabel(activity.actorRole, "Activity")} •{" "}
                            {formatTimestamp(activity.occurredAt)}
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
      </div>

      <RoadmapCard data={setupState} />

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

function SummaryTile({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
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
      ? "Add the first unit or import the template before approval checks apply."
      : isComplete
        ? "The live structure is in place. Setup is complete and this page now stays as the completion summary."
        : isGoverned && !isReadyForApproval
      ? "Reopen the approved draft and clear the remaining issues before publishing."
          : isGoverned
        ? "The approved draft is ready to move into the live structure."
            : isReadyForApproval
              ? "The draft meets the review checks. You can approve it now."
              : "Keep working in the draft workspace until the blocking issues are cleared.";

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

function RoadmapCard({ data }: { data: TenantSetupStateDto | undefined }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Setup progress</CardTitle>
        <CardDescription>
          Structure comes first. Once the approved structure is published, setup
          is complete.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {SETUP_STEPS.map((step) => (
          <SetupMilestoneCard
            key={step.key}
            step={step}
            state={getStepState(step.key, data)}
          />
        ))}
      </CardContent>
    </Card>
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

  return (
    <div className="flex h-full flex-col rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Icon className="size-4" />
          </div>
          <p className="font-medium">{step.title}</p>
        </div>
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {stateLabel}
        </span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{step.description}</p>
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
