"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ClipboardList,
  Flag,
  History,
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
import { toast } from "sonner";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
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
      description: "The published structure is live and Core is unlocked.",
    };
  }

  if (phase === "structurallyGoverned") {
    return {
      title: "Publish the approved structure",
      description:
        "The approved structure is locked until you publish or reopen it.",
    };
  }

  if (!hasDraftUnits) {
    return {
      title: "Start the draft",
      description: "Open Draft Structure to add units or import a template.",
    };
  }

  if (blockingIssueCount > 0) {
    return {
      title: "Clear draft blockers",
      description: "Resolve blockers in Draft Structure before approval.",
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
    description: "Continue refining the structure in Draft Structure.",
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

function getSetupSummaryLine({
  phase,
  hasDraftUnits,
  unitCount,
  rootUnitCount,
  blockingIssueCount,
  warningCount,
  isReadyForApproval,
}: {
  phase: CoreSetupPhase;
  hasDraftUnits: boolean;
  unitCount: number;
  rootUnitCount: number;
  blockingIssueCount: number;
  warningCount: number;
  isReadyForApproval: boolean;
}) {
  if (!hasDraftUnits) {
    return "No draft units yet.";
  }

  const counts = `${unitCount} unit${unitCount === 1 ? "" : "s"} • ${rootUnitCount} top-level`;

  if (isSetupCompletePhase(phase)) {
    return `${counts} • live across Core`;
  }

  if (phase === "structurallyGoverned") {
    return blockingIssueCount > 0
      ? `${counts} • ${blockingIssueCount} blocker${blockingIssueCount === 1 ? "" : "s"} to clear`
      : `${counts} • ready to publish`;
  }

  if (blockingIssueCount > 0) {
    return `${counts} • ${blockingIssueCount} blocker${blockingIssueCount === 1 ? "" : "s"}`;
  }

  if (warningCount > 0) {
    return `${counts} • ${warningCount} warning${warningCount === 1 ? "" : "s"}`;
  }

  return `${counts} • ${isReadyForApproval ? "ready for approval" : "in progress"}`;
}

function getReadinessStatusLabel({
  phase,
  hasDraftUnits,
  blockingIssueCount,
  warningCount,
  isReadyForApproval,
}: {
  phase: CoreSetupPhase;
  hasDraftUnits: boolean;
  blockingIssueCount: number;
  warningCount: number;
  isReadyForApproval: boolean;
}) {
  if (!hasDraftUnits) {
    return "Waiting";
  }

  if (blockingIssueCount > 0) {
    return `${blockingIssueCount} blocker${blockingIssueCount === 1 ? "" : "s"}`;
  }

  if (warningCount > 0) {
    return `${warningCount} warning${warningCount === 1 ? "" : "s"}`;
  }

  if (isSetupCompletePhase(phase)) {
    return "Published";
  }

  if (phase === "structurallyGoverned") {
    return "Ready to publish";
  }

  return isReadyForApproval ? "Ready to approve" : "In progress";
}

function getReadinessSummary({
  phase,
  hasDraftUnits,
  blockingIssueCount,
  warningCount,
  isReadyForApproval,
}: {
  phase: CoreSetupPhase;
  hasDraftUnits: boolean;
  blockingIssueCount: number;
  warningCount: number;
  isReadyForApproval: boolean;
}) {
  if (!hasDraftUnits) {
    return "No units yet.";
  }

  if (blockingIssueCount > 0) {
    return "Resolve blockers in Draft Structure before approval.";
  }

  if (warningCount > 0) {
    return "Review warnings in Draft Structure before approval.";
  }

  if (isSetupCompletePhase(phase)) {
    return "Live structure.";
  }

  if (phase === "structurallyGoverned") {
    return "Ready to publish.";
  }

  return isReadyForApproval ? "Ready for approval." : "In progress.";
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

const activityCopyMap: Record<
  string,
  { title: string; description: (name: string) => string }
> = {
  draftCreated: {
    title: "Unit added",
    description: (name) => `${name} added a draft unit`,
  },
  draftUpdated: {
    title: "Unit updated",
    description: (name) => `${name} updated the draft structure`,
  },
  draftDeleted: {
    title: "Unit deleted",
    description: (name) => `${name} deleted a draft unit`,
  },
  draftCleared: {
    title: "Draft cleared",
    description: (name) => `${name} removed all draft units`,
  },
  draftImportUploaded: {
    title: "Import uploaded",
    description: (name) => `${name} uploaded a structure import`,
  },
  draftImportApplied: {
    title: "Import applied",
    description: (name) => `${name} applied a structure import`,
  },
  approved: {
    title: "Draft approved",
    description: (name) => `${name} approved the structure`,
  },
  reopened: {
    title: "Draft reopened",
    description: (name) => `${name} reopened the structure`,
  },
  published: {
    title: "Structure published",
    description: (name) => `${name} published the structure to live`,
  },
  completed: {
    title: "Setup completed",
    description: (name) => `${name} completed setup`,
  },
};

function getActivityCopy(activity: TenantSetupActivityDto) {
  const copy = activityCopyMap[activity.activityType];
  if (copy) {
    return {
      title: copy.title,
      description: copy.description(activity.actorFullName),
    };
  }
  return {
    title: "Activity recorded",
    description: `${activity.actorFullName} performed an action`,
  };
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
  const importEmployeesHref = buildTenantContextHref(
    "/employees/import",
    tenantId
  );
  const isTenantContextReadOnly = !!tenantId;
  const canAccess = canAccessCoreSetup(user) || isTenantContextReadOnly;
  const [localError, setLocalError] = useState<string | null>(null);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [visibleActivityCount, setVisibleActivityCount] = useState(3);

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
  const hasDraftUnits = (readiness?.totalUnitCount ?? 0) > 0;
  const blockingIssueCount = hasDraftUnits
    ? (readiness?.blockingIssueCount ?? 0)
    : 0;
  const warningCount = hasDraftUnits ? (readiness?.warningCount ?? 0) : 0;
  const hasBlockingIssues = hasDraftUnits && blockingIssueCount > 0;
  const hasWarnings = hasDraftUnits && warningCount > 0;
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
      router.refresh();
      toast.success("Draft approved", {
        description: "The structure is locked and ready for publish review.",
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
      await Promise.allSettled([refreshSetupAccess(), refetchReadiness()]);
      router.refresh();
      toast.success("Structure published", {
        description: "The published structure is now live across Core.",
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
      await Promise.allSettled([refreshSetupAccess(), refetchReadiness()]);
      router.refresh();
      toast.success("Draft reopened", {
        description: "The structure can be edited again in Draft Structure.",
      });
    } catch (error) {
      setLocalError(getErrorMessage(error));
    }
  };

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
  const summaryLine = getSetupSummaryLine({
    phase,
    hasDraftUnits,
    unitCount: readiness?.totalUnitCount ?? 0,
    rootUnitCount: readiness?.rootUnitCount ?? 0,
    blockingIssueCount,
    warningCount,
    isReadyForApproval,
  });
  const readinessStatusLabel = getReadinessStatusLabel({
    phase,
    hasDraftUnits,
    blockingIssueCount,
    warningCount,
    isReadyForApproval,
  });
  const readinessSummary = getReadinessSummary({
    phase,
    hasDraftUnits,
    blockingIssueCount,
    warningCount,
    isReadyForApproval,
  });
  const readinessStatusVariant = hasBlockingIssues
    ? "destructive"
    : hasWarnings || isReadyForApproval || isGoverned || isCoreUnlocked
      ? "secondary"
      : "outline";
  const showExpandedReadiness =
    !!readinessError ||
    (setupStarted && isReadinessLoading && !readiness) ||
    hasBlockingIssues ||
    hasWarnings;
  const summaryActions: Array<{
    label: string;
    pendingLabel?: string;
    onClick: () => void;
    variant?: "default" | "outline";
    disabled?: boolean;
    isLoading?: boolean;
  }> = [];

  if (!setupStarted) {
    if (!isTenantContextReadOnly) {
      summaryActions.push({
        label: "Open draft workspace",
        onClick: () => router.push(SETUP_DRAFT_ENTRY_PATH),
      });
    }
  } else if (isActivated) {
    if (isTenantContextReadOnly) {
      summaryActions.push({
        label: "View draft workspace",
        onClick: () => router.push(draftStructureHref),
      });
    } else if (isReadyForApproval) {
      summaryActions.push(
        {
          label: "Approve structure",
          pendingLabel: "Approving...",
          onClick: () => {
            void handleApprove();
          },
          disabled: approvalDisabled,
          isLoading: approveStructure.isLoading,
        },
        {
          label: "Open draft workspace",
          onClick: () => router.push(draftStructureHref),
          variant: "outline",
        }
      );
    } else {
      summaryActions.push({
        label: "Open draft workspace",
        onClick: () => router.push(draftStructureHref),
      });
    }
  } else if (isGoverned) {
    if (isTenantContextReadOnly) {
      summaryActions.push({
        label: "View approved structure",
        onClick: () => router.push(draftStructureHref),
      });
    } else {
      summaryActions.push(
        {
          label: "Publish structure",
          pendingLabel: "Publishing...",
          onClick: () => setPublishDialogOpen(true),
          disabled: publishDisabled,
          isLoading: publishStructure.isLoading,
        },
        {
          label: "Reopen draft",
          pendingLabel: "Reopening...",
          onClick: () => {
            void handleReopen();
          },
          variant: "outline",
          disabled: reopenDisabled,
          isLoading: reopenStructure.isLoading,
        }
      );
    }
  } else if (isCoreUnlocked) {
    summaryActions.push({
      label: "Import employees",
      onClick: () => router.push(importEmployeesHref),
    });
    summaryActions.push({
      label: "View published structure",
      onClick: () => router.push(draftStructureHref),
      variant: "outline",
    });
  }

  const visibleActivities = setupState.recentActivities.slice(
    0,
    visibleActivityCount
  );
  const hasMoreActivities =
    visibleActivityCount < setupState.recentActivities.length;
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] xl:items-start">
        <Card>
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <SetupStatusBadge status={setupState.currentPhase} />
                {setupState.isApprovedInPlatformAssistMode &&
                !isCoreUnlocked ? (
                  <Badge variant="outline">Assisted</Badge>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <h2 className="text-2xl font-semibold tracking-tight">
                  {heroCopy.title}
                </h2>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  {heroCopy.description}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span>{summaryLine}</span>
                {statusMeta ? <span>{statusMeta}</span> : null}
                {setupState.approvedAt && !isCoreUnlocked ? (
                  <span>{formatRoleLabel(setupState.approvedByRole)}</span>
                ) : null}
              </div>
            </div>

            {summaryActions.length > 0 ? (
              <div className="flex flex-wrap gap-2 lg:justify-end">
                {summaryActions.map((action) => (
                  <Button
                    key={action.label}
                    variant={action.variant}
                    onClick={action.onClick}
                    disabled={action.disabled || action.isLoading}
                  >
                    {action.isLoading ? <Spinner className="mr-1" /> : null}
                    {action.isLoading
                      ? (action.pendingLabel ?? action.label)
                      : action.label}
                  </Button>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="xl:self-stretch">
          <RecentActivityCard
            activities={visibleActivities}
            hasMoreActivities={hasMoreActivities}
            onLoadMore={() =>
              setVisibleActivityCount((currentCount) =>
                Math.min(currentCount + 3, setupState.recentActivities.length)
              )
            }
          />
        </div>
      </div>

      {showExpandedReadiness ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle>Readiness</CardTitle>
            <Badge variant={readinessStatusVariant}>
              {readinessStatusLabel}
            </Badge>
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
            ) : setupStarted && isReadinessLoading && !readiness ? (
              <ReadinessSkeleton />
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {readinessSummary}
                </p>

                {readiness && hasBlockingIssues ? (
                  <IssueSection
                    title="Blocking issues"
                    issues={readiness.blockingIssues}
                  />
                ) : null}

                {readiness && hasWarnings ? (
                  <IssueSection title="Warnings" issues={readiness.warnings} />
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      <AlertDialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <AlertTriangle className="size-5 text-amber-700" />
            </AlertDialogMedia>
            <AlertDialogTitle>Publish structure?</AlertDialogTitle>
            <AlertDialogDescription>
              Makes the approved structure live.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={publishStructure.isLoading}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handlePublish();
              }}
              disabled={publishStructure.isLoading}
            >
              {publishStructure.isLoading ? <Spinner className="mr-1" /> : null}
              {publishStructure.isLoading
                ? "Publishing..."
                : "Publish structure"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

function RecentActivityCard({
  activities,
  hasMoreActivities,
  onLoadMore,
}: {
  activities: TenantSetupActivityDto[];
  hasMoreActivities: boolean;
  onLoadMore: () => void;
}) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <CardTitle>Recent activity</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        {activities.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
            <div className="flex size-8 items-center justify-center rounded-full border bg-muted/30 text-muted-foreground/60">
              <History className="size-3.5" />
            </div>
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          </div>
        ) : (
          <div className="space-y-0">
            {activities.map((activity) => {
              const activityCopy = getActivityCopy(activity);

              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 border-b py-3 first:pt-0 last:border-b-0 last:pb-0"
                >
                  <div className="mt-0.5 flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <History className="size-3.5" />
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
              );
            })}
            {hasMoreActivities ? (
              <div className="pt-3">
                <Button variant="outline" size="sm" onClick={onLoadMore}>
                  Load more
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
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

      <div className="grid gap-2 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-14 rounded-xl" />
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-full max-w-2xl" />
            <Skeleton className="h-4 w-full max-w-xl" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-10 w-36" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] xl:items-start">
        <div className="space-y-4 rounded-xl border p-5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-full max-w-2xl" />
          <Skeleton className="h-4 w-full max-w-xl" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-36" />
          </div>
        </div>
        <div className="rounded-xl border p-5">
          <Skeleton className="h-5 w-32" />
          <div className="mt-4 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReadinessSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-16 rounded-xl" />
      <Skeleton className="h-36 rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
    </div>
  );
}
