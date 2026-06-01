"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Flag,
  History,
  Rocket,
} from "lucide-react";
import { ApiError } from "@repo/api";
import { useTenantContext } from "@/components/core-tenant-context-provider";
import { buildTenantContextHref } from "@/lib/tenant-navigation";
import { cn } from "@/lib/utils";
import type {
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
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { SetupStatusBadge } from "./setup-status-badge";
import {
  useSetupReadiness,
} from "./use-setup";
import { SETUP_DRAFT_ENTRY_PATH } from "./setup-entry-routing";

type SetupProgressStepKey =
  | "setupStarted"
  | "draftReady"
  | "published";

type SetupProgressVisualState =
  | "complete"
  | "current"
  | "warning"
  | "blocked"
  | "upcoming";

interface SetupProgressContext {
  data: TenantSetupStateDto | undefined;
  hasDraftUnits: boolean;
  blockingIssueCount: number;
  warningCount: number;
  isReadyForApproval: boolean;
  hasReadinessData: boolean;
  isReadinessLoading: boolean;
  hasReadinessError: boolean;
}

interface SetupProgressStepModel {
  key: SetupProgressStepKey;
  title: string;
  icon: typeof Flag;
  state: SetupProgressVisualState;
  isCurrent: boolean;
  statusLabel: string;
  description: string;
  meta?: string;
  showAssistedBadge?: boolean;
}

const SETUP_PROGRESS_STEPS: Array<{
  key: SetupProgressStepKey;
  title: string;
  icon: typeof Flag;
}> = [
  {
    key: "setupStarted",
    title: "Setup started",
    icon: Flag,
  },
  {
    key: "draftReady",
    title: "Draft data in place",
    icon: ClipboardList,
  },
  {
    key: "published",
    title: "Published live",
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

function hasLiveStructure(data: TenantSetupStateDto | undefined) {
  return !!data?.hasPublishedStructure;
}

function getCompletedSetupProgressStepCount(
  data: TenantSetupStateDto | undefined
) {
  if (!data || data.canStartSetup) {
    return 0;
  }

  return Math.max(0, Math.min(data.currentStep, SETUP_PROGRESS_STEPS.length));
}

function getDraftProgressMeta(
  data: TenantSetupStateDto | undefined,
  hasDraftUnits: boolean
) {
  if (!hasDraftUnits) {
    return undefined;
  }

  if (data?.requiresRepublish) {
    const liveAt = data.operationalAt ?? data.structurallyPublishedAt;

    return liveAt
      ? `Live stays on ${formatTimestamp(liveAt)} until republish`
      : "Draft changes are pending publish";
  }

  return "Draft data is ready for publish";
}

function getPublishedProgressMeta(data: TenantSetupStateDto | undefined) {
  const liveAt = data?.operationalAt ?? data?.structurallyPublishedAt;

  return liveAt ? `Live since ${formatTimestamp(liveAt)}` : undefined;
}

function getDraftCurrentStepState({
  data,
  hasDraftUnits,
  blockingIssueCount,
  warningCount,
  isReadyForApproval,
  hasReadinessData,
  isReadinessLoading,
  hasReadinessError,
}: SetupProgressContext) {
  if (!hasReadinessData && isReadinessLoading) {
    return {
      state: "current" as const,
      statusLabel: "Checking",
      description: "Checking the current draft before publish.",
    };
  }

  if (hasReadinessError) {
    return {
      state: "warning" as const,
      statusLabel: "Check readiness",
      description:
        "Readiness details are unavailable. Review the readiness section below.",
    };
  }

  if (!hasReadinessData) {
    return {
      state: "current" as const,
      statusLabel: "In progress",
      description: "Continue refining the draft structure.",
    };
  }

  if (!hasDraftUnits) {
    return {
      state: "current" as const,
      statusLabel: "In progress",
      description:
        "Add units or import a structure template before publish becomes available.",
    };
  }

  if (blockingIssueCount > 0) {
    return {
      state: "blocked" as const,
      statusLabel: "Blocked",
      description: `Resolve ${blockingIssueCount} blocker${blockingIssueCount === 1 ? "" : "s"} in Draft Structure before publishing.`,
    };
  }

  if (isReadyForApproval) {
    return {
      state: "current" as const,
      statusLabel: "Ready",
      description:
        warningCount > 0
          ? `The draft can be published now. Review ${warningCount} warning${warningCount === 1 ? "" : "s"} first if needed.`
          : data?.requiresRepublish
            ? "The updated draft passed checks and can replace the live structure when you're ready."
            : "The draft passed checks and can be published when you're ready.",
    };
  }

  if (warningCount > 0) {
    return {
      state: "warning" as const,
      statusLabel: "Review",
      description: `Review ${warningCount} warning${warningCount === 1 ? "" : "s"} before publishing.`,
    };
  }

  return {
    state: "current" as const,
    statusLabel: "In progress",
    description: "Continue refining the draft structure.",
  };
}

function getSetupProgressCallout({
  data,
  hasDraftUnits,
  blockingIssueCount,
  warningCount,
  isReadyForApproval,
  hasReadinessData,
  isReadinessLoading,
  hasReadinessError,
}: SetupProgressContext) {
  if (!data) {
    return "Checking setup progress...";
  }

  if (hasLiveStructure(data) && !data.isDraftCycleActive) {
    return "Live structure is available. Reopen the draft when changes are needed.";
  }

  if (data.canStartSetup) {
    return "Next: Start setup from Draft Structure.";
  }

  if (!hasReadinessData && isReadinessLoading) {
    return "Next: Checking current draft readiness.";
  }

  if (hasReadinessError) {
    return "Next: Review readiness details below.";
  }

  if (!hasReadinessData) {
    return `Next: ${data.nextAction}.`;
  }

  if (!hasDraftUnits) {
    return "Next: Add units or import a structure template.";
  }

  if (blockingIssueCount > 0) {
    return `Next: Clear ${blockingIssueCount} blocker${blockingIssueCount === 1 ? "" : "s"} in Draft Structure.`;
  }

  if (isReadyForApproval) {
    return data.requiresRepublish
      ? "Next: Publish the latest draft to refresh the live structure."
      : "Next: Publish the draft structure.";
  }

  if (warningCount > 0) {
    return `Next: Review ${warningCount} warning${warningCount === 1 ? "" : "s"} before publishing.`;
  }

  return `Next: ${data.nextAction}.`;
}

function getSetupProgressSteps(
  context: SetupProgressContext
): SetupProgressStepModel[] {
  const completedStepCount = getCompletedSetupProgressStepCount(context.data);
  const currentStepKey =
    completedStepCount < SETUP_PROGRESS_STEPS.length
      ? SETUP_PROGRESS_STEPS[completedStepCount]?.key ?? null
      : null;

  return SETUP_PROGRESS_STEPS.map((step, index) => {
    const isComplete = index < completedStepCount;
    const isCurrent = step.key === currentStepKey;

    if (isComplete) {
      switch (step.key) {
        case "setupStarted":
          return {
            ...step,
            state: "complete",
            isCurrent: false,
            statusLabel: "Complete",
            description: "Draft workspace is active and setup is underway.",
            meta: context.data?.activatedAt
              ? `Started ${formatTimestamp(context.data.activatedAt)}`
              : undefined,
          } satisfies SetupProgressStepModel;
        case "draftReady":
          return {
            ...step,
            state: "complete",
            isCurrent: false,
            statusLabel: "Complete",
            description: context.data?.requiresRepublish
              ? "A new draft is active while the current live structure stays available."
              : "Draft data is in place and ready for publish.",
            meta: getDraftProgressMeta(context.data, context.hasDraftUnits),
          } satisfies SetupProgressStepModel;
        case "published":
          return {
            ...step,
            state: "complete",
            isCurrent: false,
            statusLabel: "Live",
            description: "The published structure is live across Core.",
            meta: getPublishedProgressMeta(context.data),
          } satisfies SetupProgressStepModel;
      }
    }

    if (isCurrent) {
      switch (step.key) {
        case "setupStarted":
          return {
            ...step,
            state: "current",
            isCurrent: true,
            statusLabel: "Start here",
            description: "Open Draft Structure to begin building the hierarchy.",
          } satisfies SetupProgressStepModel;
        case "draftReady": {
          const draftState = getDraftCurrentStepState({
            data: context.data,
            hasDraftUnits: context.hasDraftUnits,
            blockingIssueCount: context.blockingIssueCount,
            warningCount: context.warningCount,
            isReadyForApproval: context.isReadyForApproval,
            hasReadinessData: context.hasReadinessData,
            isReadinessLoading: context.isReadinessLoading,
            hasReadinessError: context.hasReadinessError,
          });

          return {
            ...step,
            isCurrent: true,
            ...draftState,
          } satisfies SetupProgressStepModel;
        }
        case "published":
          return {
            ...step,
            state: "current",
            isCurrent: true,
            statusLabel: context.data?.requiresRepublish
              ? "Ready to republish"
              : "Ready to publish",
            description:
              context.data?.requiresRepublish
                ? "Publish the latest draft when you're ready. The current live structure stays active until then."
                : "Publish the draft structure to make it live across Core.",
            meta: context.data?.requiresRepublish
              ? getPublishedProgressMeta(context.data)
              : undefined,
          } satisfies SetupProgressStepModel;
      }
    }

    switch (step.key) {
      case "setupStarted":
        return {
          ...step,
          state: "upcoming",
          isCurrent: false,
          statusLabel: "Later",
          description: "Setup begins once Draft Structure is opened.",
        } satisfies SetupProgressStepModel;
      case "draftReady":
        return {
          ...step,
          state: "upcoming",
          isCurrent: false,
          statusLabel: "Later",
          description:
            "Add units or import a structure template to create draft data.",
        } satisfies SetupProgressStepModel;
      case "published":
        return {
          ...step,
          state: "upcoming",
          isCurrent: false,
          statusLabel: "Later",
          description: "Publish when the draft is ready.",
        } satisfies SetupProgressStepModel;
    }
  });
}

function getSetupProgressVisualStyle(state: SetupProgressVisualState) {
  switch (state) {
    case "complete":
      return {
        cardClassName:
          "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/20",
        badgeClassName:
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300",
        nodeClassName:
          "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950",
      };
    case "blocked":
      return {
        cardClassName: "border-destructive/20 bg-destructive/5",
        badgeClassName:
          "border-destructive/20 bg-destructive/10 text-destructive",
        nodeClassName: "bg-destructive/10 text-destructive",
      };
    case "warning":
      return {
        cardClassName:
          "border-amber-200 bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-950/20",
        badgeClassName:
          "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300",
        nodeClassName:
          "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
      };
    case "current":
      return {
        cardClassName: "border-primary/30 bg-primary/5",
        badgeClassName: "border-primary/20 bg-primary/10 text-primary",
        nodeClassName: "bg-primary text-primary-foreground",
      };
    default:
      return {
        cardClassName: "bg-background",
        badgeClassName: "border-border bg-background text-muted-foreground",
        nodeClassName:
          "border border-border bg-muted/30 text-muted-foreground",
      };
  }
}

function getHeroCopy({
  hasPublishedStructure,
  isDraftCycleActive,
  requiresRepublish,
  hasDraftUnits,
  isReadyForApproval,
  blockingIssueCount,
}: {
  hasPublishedStructure: boolean;
  isDraftCycleActive: boolean;
  requiresRepublish: boolean;
  hasDraftUnits: boolean;
  isReadyForApproval: boolean;
  blockingIssueCount: number;
}) {
  if (hasPublishedStructure && !isDraftCycleActive) {
    return {
      title: "Structure live",
      description:
        "The published structure is active across Core. Reopen the draft whenever changes are needed.",
    };
  }

  if (requiresRepublish) {
    return {
      title: "Draft changes underway",
      description:
        "A new draft is open. Live stays active until you publish the latest changes.",
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
      description: "Resolve blockers in Draft Structure before publishing.",
    };
  }

  if (isReadyForApproval) {
    return {
      title: "Publish the draft",
      description:
        "Checks are clean. Publish the structure when you're ready.",
    };
  }

  return {
    title: "Review the draft",
    description: "Continue refining the structure in Draft Structure.",
  };
}

function getHeaderDescription({
  hasPublishedStructure,
  isDraftCycleActive,
  requiresRepublish,
  hasDraftUnits,
  isReadyForApproval,
  blockingIssueCount,
}: {
  hasPublishedStructure: boolean;
  isDraftCycleActive: boolean;
  requiresRepublish: boolean;
  hasDraftUnits: boolean;
  isReadyForApproval: boolean;
  blockingIssueCount: number;
}) {
  if (hasPublishedStructure && !isDraftCycleActive) {
    return "Review the live structure, reopen the draft when changes are needed, and track recent activity here.";
  }

  if (requiresRepublish) {
    return "Review the reopened draft here, then publish when the new structure is ready to replace live.";
  }

  if (!hasDraftUnits) {
    return "Use Draft Structure to start the hierarchy, then return here to publish it live.";
  }

  if (blockingIssueCount > 0) {
    return "Use Draft Structure for fixes; use this page to monitor readiness and publish.";
  }

  return isReadyForApproval
    ? "Use this page to publish now or return to Draft Structure for final checks."
    : "Use Draft Structure for edits; use this page to manage publish and reopen.";
}

function getSetupSummaryLine({
  hasDraftUnits,
  unitCount,
  rootUnitCount,
  blockingIssueCount,
  warningCount,
}: {
  hasDraftUnits: boolean;
  unitCount: number;
  rootUnitCount: number;
  blockingIssueCount: number;
  warningCount: number;
}): string | null {
  if (!hasDraftUnits) {
    return null;
  }

  const counts = `${unitCount} unit${unitCount === 1 ? "" : "s"} · ${rootUnitCount} top-level`;

  if (blockingIssueCount > 0) {
    return `${counts} · ${blockingIssueCount} blocker${blockingIssueCount === 1 ? "" : "s"}`;
  }

  if (warningCount > 0) {
    return `${counts} · ${warningCount} warning${warningCount === 1 ? "" : "s"}`;
  }

  return counts;
}

function getReadinessStatusLabel({
  hasPublishedStructure,
  isDraftCycleActive,
  requiresRepublish,
  hasDraftUnits,
  blockingIssueCount,
  warningCount,
  isReadyForApproval,
}: {
  hasPublishedStructure: boolean;
  isDraftCycleActive: boolean;
  requiresRepublish: boolean;
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

  if (hasPublishedStructure && !isDraftCycleActive) {
    return "Live";
  }

  if (requiresRepublish) {
    return isReadyForApproval ? "Ready to republish" : "Draft active";
  }

  return isReadyForApproval ? "Ready to publish" : "In progress";
}

function getReadinessSummary({
  hasPublishedStructure,
  isDraftCycleActive,
  requiresRepublish,
  hasDraftUnits,
  blockingIssueCount,
  warningCount,
  isReadyForApproval,
}: {
  hasPublishedStructure: boolean;
  isDraftCycleActive: boolean;
  requiresRepublish: boolean;
  hasDraftUnits: boolean;
  blockingIssueCount: number;
  warningCount: number;
  isReadyForApproval: boolean;
}) {
  if (!hasDraftUnits) {
    return "No draft data yet.";
  }

  if (blockingIssueCount > 0) {
    return "Resolve blockers in Draft Structure before publishing.";
  }

  if (warningCount > 0) {
    return "Review warnings in Draft Structure before publishing.";
  }

  if (hasPublishedStructure && !isDraftCycleActive) {
    return "Live structure.";
  }

  if (requiresRepublish) {
    return isReadyForApproval
      ? "Ready to republish the latest draft."
      : "Current draft will replace the live structure when published.";
  }

  return isReadyForApproval ? "Ready to publish." : "In progress.";
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
    title: "Legacy approval recorded",
    description: (name) => `${name} used the previous approval workflow`,
  },
  reopened: {
    title: "Draft reopened",
    description: (name) => `${name} reopened the draft while live stayed active`,
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
    setupTransitionKind,
    startSetup,
    publishSetup,
    reopenSetup,
    refreshSetupAccess,
  } = useCoreSetupAccess();
  const setupStarted = !!setupState && !setupState.canStartSetup;
  const pageTitle = setupStarted ? "Setup summary" : "Setup";
  const draftCycleActive = setupState?.isDraftCycleActive ?? false;
  const {
    data: readiness,
    error: readinessError,
    isLoading: isReadinessLoading,
    refetch: refetchReadiness,
  } = useSetupReadiness(canAccess && setupStarted && draftCycleActive);
  const isActivating = setupTransitionKind === "activating";
  const isPublishing = setupTransitionKind === "publishing";
  const isReopening = setupTransitionKind === "reopening";

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
  const hasLivePublishedStructure = setupState.hasPublishedStructure;
  const isCoreUnlocked = hasLivePublishedStructure;
  const canReopenLiveDraft =
    phase === "structurallyGoverned" ||
    (hasLivePublishedStructure && !setupState.isDraftCycleActive);
  const hasDraftUnits =
    setupState.hasDraftStructure || (readiness?.totalUnitCount ?? 0) > 0;
  const blockingIssueCount = hasDraftUnits
    ? (readiness?.blockingIssueCount ?? 0)
    : 0;
  const warningCount = hasDraftUnits ? (readiness?.warningCount ?? 0) : 0;
  const hasBlockingIssues = hasDraftUnits && blockingIssueCount > 0;
  const hasWarnings = hasDraftUnits && warningCount > 0;
  const isReadyForPublish = !!readiness?.isReadyForApproval;
  const heroCopy = getHeroCopy({
    hasPublishedStructure: hasLivePublishedStructure,
    isDraftCycleActive: setupState.isDraftCycleActive,
    requiresRepublish: setupState.requiresRepublish,
    hasDraftUnits,
    isReadyForApproval: isReadyForPublish,
    blockingIssueCount,
  });
  const pageError = localError ?? null;
  const pageDescription = getHeaderDescription({
    hasPublishedStructure: hasLivePublishedStructure,
    isDraftCycleActive: setupState.isDraftCycleActive,
    requiresRepublish: setupState.requiresRepublish,
    hasDraftUnits,
    isReadyForApproval: isReadyForPublish,
    blockingIssueCount,
  });

  const handlePublish = async () => {
    if (setupState.version == null) {
      setLocalError("The latest setup version is required before publishing.");
      return;
    }

    setLocalError(null);

    try {
      await publishSetup({
        expectedVersion: setupState.version,
      });
      setPublishDialogOpen(false);
      await Promise.allSettled([refetchReadiness()]);
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
      await reopenSetup({
        expectedVersion: setupState.version,
      });
      await Promise.allSettled([refetchReadiness()]);
      toast.success("Draft reopened", {
        description: "The structure can be edited again in Draft Structure.",
      });
    } catch (error) {
      setLocalError(getErrorMessage(error));
    }
  };

  const publishDisabled =
    phase === "structurallyGoverned"
      ? isPublishing
      : !setupState.isDraftCycleActive ||
        isReadinessLoading ||
        !isReadyForPublish ||
        isPublishing;
  const reopenDisabled =
    !canReopenLiveDraft ||
    isReopening;
  const summaryLine = getSetupSummaryLine({
    hasDraftUnits,
    unitCount: readiness?.totalUnitCount ?? 0,
    rootUnitCount: readiness?.rootUnitCount ?? 0,
    blockingIssueCount,
    warningCount,
  });
  const readinessStatusLabel = getReadinessStatusLabel({
    hasPublishedStructure: hasLivePublishedStructure,
    isDraftCycleActive: setupState.isDraftCycleActive,
    requiresRepublish: setupState.requiresRepublish,
    hasDraftUnits,
    blockingIssueCount,
    warningCount,
    isReadyForApproval: isReadyForPublish,
  });
  const readinessSummary = getReadinessSummary({
    hasPublishedStructure: hasLivePublishedStructure,
    isDraftCycleActive: setupState.isDraftCycleActive,
    requiresRepublish: setupState.requiresRepublish,
    hasDraftUnits,
    blockingIssueCount,
    warningCount,
    isReadyForApproval: isReadyForPublish,
  });
  const readinessStatusVariant = hasBlockingIssues
    ? "destructive"
    : hasWarnings || isReadyForPublish || setupState.requiresRepublish || isCoreUnlocked
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
        pendingLabel: "Activating...",
        onClick: async () => {
          try {
            await startSetup();
            router.push(SETUP_DRAFT_ENTRY_PATH);
          } catch {
            toast.error("Setup could not be activated.", {
              description: "Try opening the draft workspace again.",
            });
          }
        },
        disabled: isActivating,
        isLoading: isActivating,
      });
    }
  } else if (phase === "structurallyGoverned" && !hasLivePublishedStructure) {
    if (isTenantContextReadOnly) {
      summaryActions.push({
        label: "View approved structure",
        onClick: () => router.push(draftStructureHref),
      });
    } else {
      summaryActions.push(
        {
          label: "Reopen draft",
          pendingLabel: "Reopening...",
          onClick: () => {
            void handleReopen();
          },
          variant: "outline",
          disabled: reopenDisabled,
          isLoading: isReopening,
        },
        {
          label: "Publish structure",
          pendingLabel: "Publishing...",
          onClick: () => setPublishDialogOpen(true),
          disabled: publishDisabled,
          isLoading: isPublishing,
        }
      );
    }
  } else if (setupState.isDraftCycleActive) {
    const showPublishAction = !isTenantContextReadOnly && (isReadyForPublish || setupState.requiresRepublish);
    if (isTenantContextReadOnly) {
      summaryActions.push({
        label: "View draft workspace",
        onClick: () => router.push(draftStructureHref),
      });
    } else {
      summaryActions.push({
        label: "Open draft workspace",
        onClick: () => router.push(draftStructureHref),
        variant: showPublishAction ? "outline" : undefined,
      });
      if (showPublishAction) {
        summaryActions.push({
          label: setupState.requiresRepublish ? "Publish changes" : "Publish structure",
          pendingLabel: "Publishing...",
          onClick: () => setPublishDialogOpen(true),
          disabled: publishDisabled,
          isLoading: isPublishing,
        });
      }
    }
  } else if (hasLivePublishedStructure) {
    if (isTenantContextReadOnly) {
      summaryActions.push({
        label: "View live structure",
        onClick: () => router.push(draftStructureHref),
      });
    } else {
      summaryActions.push(
        {
          label: "Reopen draft",
          pendingLabel: "Reopening...",
          onClick: () => {
            void handleReopen();
          },
          variant: "outline",
          disabled: reopenDisabled,
          isLoading: isReopening,
        },
        {
          label: "Import employees",
          onClick: () => router.push(importEmployeesHref),
        }
      );
    }
  }

  const visibleActivities = setupState.recentActivities.slice(
    0,
    visibleActivityCount
  );
  const hasMoreActivities =
    visibleActivityCount < setupState.recentActivities.length;
  const liveAt = setupState.operationalAt ?? setupState.structurallyPublishedAt;
  const statusMeta = hasLivePublishedStructure
    ? setupState.requiresRepublish
      ? liveAt
        ? `Live stays on ${formatTimestamp(liveAt)} until republish`
        : "Live structure stays active until republish"
      : liveAt
        ? `Live since ${formatTimestamp(liveAt)}`
        : "Live structure available"
    : setupState.activatedAt
      ? `Started ${formatTimestamp(setupState.activatedAt)}`
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] xl:items-start">
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-col gap-4 px-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <SetupStatusBadge setupState={setupState} />
                  {setupState.isApprovedInPlatformAssistMode &&
                  phase === "structurallyGoverned" ? (
                    <Badge variant="outline">Assisted</Badge>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {heroCopy.title}
                  </h2>
                  {setupState.requiresRepublish ? (
                    <p className="max-w-2xl text-sm text-muted-foreground">
                      Draft changes are underway. The current live structure
                      stays active until you publish the latest version. {" "}
                      <Link
                        href={draftStructureHref}
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        Review the draft here
                      </Link>
                    </p>
                  ) : isCoreUnlocked ? (
                    <p className="max-w-2xl text-sm text-muted-foreground">
                      The published structure is live.{" "}
                      <Link
                        href={draftStructureHref}
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        View it here
                      </Link>
                    </p>
                  ) : (
                    <p className="max-w-2xl text-sm text-muted-foreground">
                      {heroCopy.description}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  {summaryLine ? (
                    <p className="text-sm text-muted-foreground">{summaryLine}</p>
                  ) : null}
                  {statusMeta ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <History className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      <span>{statusMeta}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              {summaryActions.length > 0 ? (
                <div className="flex flex-nowrap gap-2 justify-end">
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

          <SetupProgressPanel
            data={setupState}
            hasDraftUnits={hasDraftUnits}
            blockingIssueCount={blockingIssueCount}
            warningCount={warningCount}
            isReadyForApproval={isReadyForPublish}
            hasReadinessData={!!readiness}
            isReadinessLoading={isReadinessLoading}
            hasReadinessError={!!readinessError}
          />
        </div>

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
              {setupState.requiresRepublish
                ? "Replaces the current live structure with the latest draft."
                : "Makes the current draft live across Core."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPublishing}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handlePublish();
              }}
              disabled={isPublishing}
            >
              {isPublishing ? <Spinner className="mr-1" /> : null}
              {isPublishing
                ? "Publishing..."
                : "Publish structure"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SetupProgressPanel({
  data,
  hasDraftUnits,
  blockingIssueCount,
  warningCount,
  isReadyForApproval,
  hasReadinessData,
  isReadinessLoading,
  hasReadinessError,
}: SetupProgressContext) {
  const steps = getSetupProgressSteps({
    data,
    hasDraftUnits,
    blockingIssueCount,
    warningCount,
    isReadyForApproval,
    hasReadinessData,
    isReadinessLoading,
    hasReadinessError,
  });
  const completedStepCount = getCompletedSetupProgressStepCount(data);
  const totalStepCount = SETUP_PROGRESS_STEPS.length;
  const progressValue = (completedStepCount / totalStepCount) * 100;
  const remainingStepCount = Math.max(totalStepCount - completedStepCount, 0);
  const progressCallout = getSetupProgressCallout({
    data,
    hasDraftUnits,
    blockingIssueCount,
    warningCount,
    isReadyForApproval,
    hasReadinessData,
    isReadinessLoading,
    hasReadinessError,
  });

  return (
    <Card>
      <CardHeader className="space-y-4 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Setup progress</CardTitle>
            <p className="text-sm text-muted-foreground">
              {completedStepCount === totalStepCount
                ? "Every required setup milestone is complete."
                : "Track what is done, what needs attention, and what comes next."}
            </p>
          </div>
          <Badge variant={completedStepCount === totalStepCount ? "secondary" : "outline"}>
            {completedStepCount} of {totalStepCount} complete
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{progressCallout}</span>
            <span>
              {remainingStepCount === 0
                ? "Live"
                : `${remainingStepCount} step${remainingStepCount === 1 ? "" : "s"} left`}
            </span>
          </div>
          <Progress value={progressValue} className="h-2" aria-label="Setup progress" />
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <SetupProgressCard key={step.key} step={step} index={index} />
          ))}
        </div>
      </CardContent>
    </Card>
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
              <div className="pt-4">
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

function SetupProgressCard({
  step,
  index,
}: {
  step: SetupProgressStepModel;
  index: number;
}) {
  const Icon = step.state === "complete" ? CheckCircle2 : step.icon;
  const visualStyle = getSetupProgressVisualStyle(step.state);

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 rounded-xl border p-5 text-center transition-colors",
        visualStyle.cardClassName,
        step.isCurrent ? "shadow-sm ring-1 ring-primary/10" : undefined
      )}
      aria-current={step.isCurrent ? "step" : undefined}
    >
      <div
        className={cn(
          "flex size-12 items-center justify-center rounded-full",
          visualStyle.nodeClassName
        )}
      >
        <Icon className="size-6" />
      </div>

      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Step {index + 1}
        </p>
        <p className="font-semibold">{step.title}</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Badge variant="outline" className={visualStyle.badgeClassName}>
          {step.statusLabel}
        </Badge>
        {step.showAssistedBadge ? (
          <Badge variant="outline">Assisted</Badge>
        ) : null}
      </div>

      {step.meta ? (
        <p className="text-xs text-muted-foreground">{step.meta}</p>
      ) : null}
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] xl:items-start">
        <div className="space-y-4">
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

          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-28" />
                </div>
                <Skeleton className="h-4 w-full max-w-xl" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="flex flex-col items-center gap-4 rounded-xl border p-5">
                    <Skeleton className="size-12 rounded-full" />
                    <div className="space-y-1 text-center">
                      <Skeleton className="mx-auto h-3 w-16" />
                      <Skeleton className="mx-auto h-4 w-28" />
                    </div>
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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
