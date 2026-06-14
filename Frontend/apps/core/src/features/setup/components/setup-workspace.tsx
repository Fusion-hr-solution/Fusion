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
import {
  ApiError,
  type DraftSetupReadinessDto,
  type DraftSetupIssueDto,
  type DraftSetupIssueCategory,
  type TenantSetupActivityDto,
  type TenantSetupStateDto,
} from "@repo/api";
import { useAuth } from "@repo/auth";
import { EmptyState } from "@repo/ui";
import { toast } from "sonner";
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
import { SetupStatusBadge } from "@/app/(pages)/setup/setup-status-badge";
import {
  usePublishedOrgUnits,
  type VersionedSetupMutationArgs,
} from "@/features/setup/api/use-setup";

// ── Props ─────────────────────────────────────────────────────────────────

export interface SetupWorkspaceProps {
  setupState: TenantSetupStateDto;
  readiness: DraftSetupReadinessDto | undefined;
  readinessError: Error | null;
  isReadinessLoading: boolean;
  refetchReadiness: () => Promise<unknown>;
  isTenantContextReadOnly: boolean;
  onPublish: (args: VersionedSetupMutationArgs) => Promise<TenantSetupStateDto>;
  onReopen: (args: VersionedSetupMutationArgs) => Promise<TenantSetupStateDto>;
  dashboardHref: string;
  draftStructureHref: string;
  importEmployeesHref: string;
  canAccess: boolean;
  isSetupLoading: boolean;
  setupError: Error | null;
  setupTransitionKind: string | null;
  refreshSetupAccess: () => Promise<void>;
}

// ── Types ─────────────────────────────────────────────────────────────────

type SetupProgressStepKey = "setupStarted" | "draftReady" | "publishedLive";

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
  statusLabel: string;
  isCurrent: boolean;
  meta: string | null;
  showAssistedBadge: boolean;
}

const SETUP_PROGRESS_STEPS: SetupProgressStepKey[] = [
  "setupStarted",
  "draftReady",
  "publishedLive",
];

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function hasLiveStructure(data: TenantSetupStateDto): boolean {
  return data.hasPublishedStructure && !data.requiresRepublish;
}

function getCompletedSetupProgressStepCount(data: TenantSetupStateDto): number {
  return [
    !data.canStartSetup,
    data.hasDraftStructure || data.hasPublishedStructure,
    hasLiveStructure(data),
  ].filter(Boolean).length;
}

function getDraftProgressMeta(options: {
  hasDraftUnits: boolean;
  blockingIssueCount: number;
  warningCount: number;
  hasReadinessData: boolean;
}): string | null {
  if (!options.hasReadinessData) return null;
  if (!options.hasDraftUnits) return "No draft units yet.";
  const parts: string[] = [];
  if (options.blockingIssueCount > 0)
    parts.push(`${options.blockingIssueCount} blocking`);
  if (options.warningCount > 0) parts.push(`${options.warningCount} warnings`);
  if (parts.length === 0) return "No issues found.";
  return parts.join(", ") + ".";
}

function getPublishedProgressMeta(options: {
  hasDraftUnits: boolean;
  blockingIssueCount: number;
  warningCount: number;
  hasReadinessData: boolean;
  isReadyForApproval: boolean;
}): string | null {
  if (!options.hasReadinessData) return null;
  if (options.isReadyForApproval) return "Live — no issues.";
  if (options.blockingIssueCount > 0 && options.warningCount > 0)
    return `${options.blockingIssueCount} blocking, ${options.warningCount} warnings.`;
  if (options.blockingIssueCount > 0)
    return `${options.blockingIssueCount} blocking.`;
  if (options.warningCount > 0) return `${options.warningCount} warnings.`;
  return null;
}

function getDraftCurrentStepState(context: SetupProgressContext): {
  state: SetupProgressVisualState;
  statusLabel: string;
  meta: string | null;
  showAssistedBadge: boolean;
} {
  if (!context.data) {
    return {
      state: "upcoming",
      statusLabel: "Not started",
      meta: null,
      showAssistedBadge: false,
    };
  }

  if (context.hasReadinessError) {
    return {
      state: "blocked",
      statusLabel: "Error",
      meta: "Could not verify readiness.",
      showAssistedBadge: false,
    };
  }

  if (!context.hasDraftUnits) {
    return {
      state: context.isReadinessLoading ? "upcoming" : "current",
      statusLabel: context.isReadinessLoading ? "Checking..." : "Not started",
      meta: context.isReadinessLoading
        ? "Checking for existing draft units..."
        : null,
      showAssistedBadge: false,
    };
  }

  if (context.blockingIssueCount > 0) {
    return {
      state: "blocked",
      statusLabel: `${context.blockingIssueCount} blocking`,
      meta: getDraftProgressMeta(context),
      showAssistedBadge: false,
    };
  }

  if (context.isReadyForApproval) {
    return {
      state: "complete",
      statusLabel: "Ready to publish",
      meta: getDraftProgressMeta(context),
      showAssistedBadge: false,
    };
  }

  if (context.warningCount > 0) {
    return {
      state: "warning",
      statusLabel: `${context.warningCount} warnings`,
      meta: getDraftProgressMeta(context),
      showAssistedBadge: false,
    };
  }

  return {
    state: "complete",
    statusLabel: "Ready to publish",
    meta: getDraftProgressMeta(context),
    showAssistedBadge: false,
  };
}

function getSetupProgressCallout(context: SetupProgressContext): string {
  if (!context.data) return "";
  const stepState = getDraftCurrentStepState(context);

  if (!context.data.isDraftCycleActive && context.data.hasPublishedStructure) {
    return !context.data.requiresRepublish
      ? "All milestones are complete."
      : "Draft changes require republishing.";
  }

  if (stepState.state === "blocked") return "Issues need resolution.";
  if (stepState.state === "warning")
    return "Review warnings before publishing.";
  if (stepState.state === "complete") return "Ready for the next step.";

  return "Continue building your structure.";
}

function getSetupProgressVisualStyle(state: SetupProgressVisualState): {
  cardClassName: string;
  nodeClassName: string;
  badgeClassName: string;
} {
  switch (state) {
    case "complete":
      return {
        cardClassName: "border-primary/20 bg-primary/5",
        nodeClassName: "bg-primary/10 text-primary",
        badgeClassName: "bg-primary/10 text-primary border-primary/20",
      };
    case "current":
      return {
        cardClassName: "border-primary/30",
        nodeClassName: "bg-primary text-primary-foreground",
        badgeClassName: "",
      };
    case "warning":
      return {
        cardClassName:
          "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20",
        nodeClassName:
          "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
        badgeClassName:
          "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300",
      };
    case "blocked":
      return {
        cardClassName:
          "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20",
        nodeClassName:
          "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
        badgeClassName:
          "border-red-300 text-red-700 dark:border-red-700 dark:text-red-300",
      };
    default:
      return {
        cardClassName: "border-dashed",
        nodeClassName: "bg-muted text-muted-foreground",
        badgeClassName: "",
      };
  }
}

function getHeroCopy(options: {
  hasPublishedStructure: boolean;
  isDraftCycleActive: boolean;
  requiresRepublish: boolean;
  hasDraftUnits: boolean;
  isReadyForApproval: boolean;
  blockingIssueCount: number;
}): { title: string; description: string } {
  if (options.hasPublishedStructure && !options.requiresRepublish) {
    return {
      title: "Your structure is live",
      description:
        "Publish updates to make further changes available across Core.",
    };
  }

  if (options.requiresRepublish) {
    return {
      title: "Draft updates in progress",
      description: "Review your draft changes and publish to make them live.",
    };
  }

  if (options.isDraftCycleActive) {
    if (options.isReadyForApproval) {
      return {
        title: "Ready to publish",
        description:
          "Your draft structure meets the requirements. Publish when you are ready.",
      };
    }

    if (options.blockingIssueCount > 0) {
      return {
        title: "Draft needs attention",
        description:
          "Resolve the blocking issues before the draft can be published.",
      };
    }

    return {
      title: "Draft structure in progress",
      description: "Add units to your draft structure and review readiness.",
    };
  }

  return {
    title: "Get started with Core setup",
    description:
      "Activate the draft workspace for your organization to define the structure, import units, and configure Core settings.",
  };
}

function getHeaderDescription(options: {
  hasPublishedStructure: boolean;
  isDraftCycleActive: boolean;
  requiresRepublish: boolean;
  hasDraftUnits: boolean;
  isReadyForApproval: boolean;
  blockingIssueCount: number;
}): string {
  if (options.hasPublishedStructure && !options.requiresRepublish)
    return "The published structure is live across Core.";
  if (options.requiresRepublish)
    return "Draft changes have been made since the last publish.";
  if (options.isDraftCycleActive) {
    if (options.isReadyForApproval)
      return "The draft is complete and ready to publish.";
    if (options.hasDraftUnits) return "Add units and resolve readiness checks.";
    return "Import or build the draft structure.";
  }
  return "Activate the draft workspace to get started.";
}

function getSetupSummaryLine(options: {
  hasDraftUnits: boolean;
  unitCount: number;
  rootUnitCount: number;
  blockingIssueCount: number;
  warningCount: number;
}): string | null {
  if (!options.hasDraftUnits) return null;
  const parts = [formatStructureCounts(options.unitCount, options.rootUnitCount)];
  if (options.blockingIssueCount > 0)
    parts.push(`${options.blockingIssueCount} blocking`);
  if (options.warningCount > 0) parts.push(`${options.warningCount} warnings`);
  return parts.join(" — ");
}

function formatStructureCounts(unitCount: number, rootUnitCount: number): string {
  return `${unitCount} unit${unitCount === 1 ? "" : "s"} • ${rootUnitCount} top-level`;
}

function getReadinessStatusLabel(options: {
  hasPublishedStructure: boolean;
  isDraftCycleActive: boolean;
  requiresRepublish: boolean;
  hasDraftUnits: boolean;
  blockingIssueCount: number;
  warningCount: number;
  isReadyForApproval: boolean;
}): string {
  if (!options.hasDraftUnits) return "No draft data";
  if (options.blockingIssueCount > 0) return "Blocked";
  if (options.warningCount > 0) return "Needs review";
  if (options.isReadyForApproval) return "Ready";
  if (options.isDraftCycleActive) return "Checking...";
  if (options.hasPublishedStructure && !options.requiresRepublish)
    return "Live";
  return "Pending";
}

function getReadinessSummary(options: {
  hasPublishedStructure: boolean;
  isDraftCycleActive: boolean;
  requiresRepublish: boolean;
  hasDraftUnits: boolean;
  blockingIssueCount: number;
  warningCount: number;
  isReadyForApproval: boolean;
}): string {
  if (options.blockingIssueCount > 0 && options.warningCount > 0)
    return `${options.blockingIssueCount} blocking issue${options.blockingIssueCount === 1 ? "" : "s"} and ${options.warningCount} warning${options.warningCount === 1 ? "" : "s"} need${options.blockingIssueCount === 1 && options.warningCount === 1 ? "s" : ""} attention.`;
  if (options.blockingIssueCount > 0)
    return `${options.blockingIssueCount} blocking issue${options.blockingIssueCount === 1 ? "" : "s"} need${options.blockingIssueCount === 1 ? "s" : ""} attention.`;
  if (options.warningCount > 0)
    return `${options.warningCount} warning${options.warningCount === 1 ? "" : "s"} found.`;
  if (options.isReadyForApproval) return "All checks pass. Ready to publish.";
  return "No issues detected.";
}

function formatRoleLabel(
  role: string | null | undefined,
  fallback: string
): string {
  if (!role?.trim()) return fallback;
  return role
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

const DRAFT_SETUP_ISSUE_CATEGORY_LABELS: Record<
  DraftSetupIssueCategory,
  string
> = {
  structure: "Draft structure",
  hierarchy: "Reporting hierarchy",
  unitTypes: "Unit types",
  requiredDetails: "Required details",
};

function getIssueGroups(issues: DraftSetupIssueDto[]): Array<{
  category: DraftSetupIssueCategory;
  label: string;
  issues: DraftSetupIssueDto[];
}> {
  const groups = new Map<DraftSetupIssueCategory, DraftSetupIssueDto[]>();

  for (const issue of issues) {
    const group = groups.get(issue.category) ?? [];
    group.push(issue);
    groups.set(issue.category, group);
  }

  return Array.from(groups.entries()).map(([category, categoryIssues]) => ({
    category,
    label: DRAFT_SETUP_ISSUE_CATEGORY_LABELS[category] ?? category,
    issues: categoryIssues,
  }));
}

const activityCopyMap: Record<string, { title: string; description: string }> =
  {
    approved: {
      title: "Structure approved",
      description: "The draft passed approval and is ready to go live.",
    },
    reopened: {
      title: "Draft reopened",
      description: "The live structure stays active while the draft is edited.",
    },
    published: {
      title: "Structure published",
      description: "The latest draft is now live across Core.",
    },
    completed: {
      title: "Setup completed",
      description: "Core setup was marked complete.",
    },
    draftCreated: {
      title: "Setup activated",
      description: "The draft workspace was opened for the first time.",
    },
    draftUpdated: {
      title: "Draft updated",
      description: "A draft unit or detail was edited.",
    },
    draftDeleted: {
      title: "Draft unit removed",
      description: "A draft unit was deleted.",
    },
    draftCleared: {
      title: "Draft structure cleared",
      description: "All draft units were removed.",
    },
    draftImportUploaded: {
      title: "Draft import uploaded",
      description: "A draft structure file was uploaded for review.",
    },
    draftImportApplied: {
      title: "Draft import applied",
      description: "Imported units were added to the draft structure.",
    },
    SetupDraftUnitCreated: {
      title: "Draft unit added",
      description: "A new draft unit was created.",
    },
    SetupDraftUnitUpdated: {
      title: "Draft unit updated",
      description: "A draft unit was edited.",
    },
    SetupDraftUnitDeleted: {
      title: "Draft unit deleted",
      description: "A draft unit was removed.",
    },
    SetupDraftStructureImported: {
      title: "Draft structure imported",
      description: "A CSV import was completed.",
    },
    SetupDraftStructureCleared: {
      title: "Draft structure cleared",
      description: "The draft workspace was cleared.",
    },
    SetupDraftPublished: {
      title: "Structure published",
      description: "The draft structure was published and is now live.",
    },
    SetupDraftReopened: {
      title: "Draft reopened",
      description: "The draft was reopened for editing.",
    },
  };

function getActivityCopy(activity: TenantSetupActivityDto): {
  title: string;
  description: string;
} {
  return (
    activityCopyMap[activity.activityType] ?? {
      title: formatRoleLabel(activity.activityType, "Activity"),
      description: "An activity was recorded.",
    }
  );
}

function getActivityActorLabel(activity: TenantSetupActivityDto): string {
  if (activity.actorFullName.trim()) {
    return activity.actorFullName;
  }

  return formatRoleLabel(activity.actorRole, "Activity");
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.message.trim()) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return "An unexpected error occurred.";
}

// ── Sub-components ─────────────────────────────────────────────────────────

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
  const completedStepCount = getCompletedSetupProgressStepCount(data!);
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
          <Badge
            variant={
              completedStepCount === totalStepCount ? "secondary" : "outline"
            }
          >
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
          <Progress
            value={progressValue}
            className="h-2"
            aria-label="Setup progress"
          />
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
                      {getActivityActorLabel(activity)} •{" "}
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

export function SetupPageSkeleton() {
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
                  <div
                    key={index}
                    className="flex flex-col items-center gap-4 rounded-xl border p-5"
                  >
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

function cn(...inputs: (string | boolean | undefined | null)[]): string {
  return inputs.filter(Boolean).join(" ");
}

// ── Helper: build setup progress steps ────────────────────────────────────

function getSetupProgressSteps(
  context: SetupProgressContext
): SetupProgressStepModel[] {
  const { data } = context;
  const completedStepCount = getCompletedSetupProgressStepCount(data!);

  const stepModels: Record<SetupProgressStepKey, SetupProgressStepModel> = {
    setupStarted: {
      key: "setupStarted",
      title: "Start setup",
      icon: Rocket,
      state: "complete",
      statusLabel: "Complete",
      isCurrent: false,
      meta: null,
      showAssistedBadge: false,
    },
    draftReady: {
      key: "draftReady",
      title: "Draft ready",
      icon: Flag,
      state: "upcoming",
      statusLabel: "Not started",
      isCurrent: false,
      meta: null,
      showAssistedBadge: false,
    },
    publishedLive: {
      key: "publishedLive",
      title: "Published live",
      icon: ClipboardList,
      state: "upcoming",
      statusLabel: "Not started",
      isCurrent: false,
      meta: null,
      showAssistedBadge: false,
    },
  };

  const draftReadyState = getDraftCurrentStepState(context);

  stepModels.setupStarted.isCurrent = completedStepCount === 0;
  stepModels.draftReady.state = draftReadyState.state;
  stepModels.draftReady.statusLabel = draftReadyState.statusLabel;
  stepModels.draftReady.meta = draftReadyState.meta;
  stepModels.draftReady.showAssistedBadge = draftReadyState.showAssistedBadge;
  stepModels.draftReady.isCurrent = completedStepCount === 1;

  if (data?.hasPublishedStructure) {
    stepModels.publishedLive.state = data.requiresRepublish
      ? "warning"
      : "complete";
    stepModels.publishedLive.statusLabel = data.requiresRepublish
      ? "Needs republish"
      : "Live";
    stepModels.publishedLive.meta = getPublishedProgressMeta({
      hasDraftUnits: context.hasDraftUnits,
      blockingIssueCount: context.blockingIssueCount,
      warningCount: context.warningCount,
      hasReadinessData: context.hasReadinessData,
      isReadyForApproval: context.isReadyForApproval,
    });
    stepModels.publishedLive.isCurrent = completedStepCount >= 2;
  }

  return SETUP_PROGRESS_STEPS.map((key) => stepModels[key]);
}

// ── Main workspace component ──────────────────────────────────────────────

export function SetupWorkspace({
  setupState,
  readiness,
  readinessError,
  isReadinessLoading,
  refetchReadiness,
  isTenantContextReadOnly,
  onPublish,
  onReopen,
  dashboardHref,
  draftStructureHref,
  importEmployeesHref,
  setupTransitionKind,
}: SetupWorkspaceProps) {
  const router = useRouter();
  const [localError, setLocalError] = useState<string | null>(null);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [visibleActivityCount, setVisibleActivityCount] = useState(3);
  const shouldLoadPublishedOrgUnits =
    setupState.hasPublishedStructure && !setupState.isDraftCycleActive;
  const { data: publishedOrgUnits } =
    usePublishedOrgUnits(shouldLoadPublishedOrgUnits);

  const setupStarted = !setupState.canStartSetup;
  const draftCycleActive = setupState.isDraftCycleActive;
  const phase = setupState.currentPhase;
  const hasLivePublishedStructure = setupState.hasPublishedStructure;
  const isCoreUnlocked = hasLivePublishedStructure;
  const canReopenLiveDraft =
    phase === "structurallyGoverned" ||
    (hasLivePublishedStructure && !draftCycleActive);
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
    isDraftCycleActive: draftCycleActive,
    requiresRepublish: setupState.requiresRepublish,
    hasDraftUnits,
    isReadyForApproval: isReadyForPublish,
    blockingIssueCount,
  });

  const pageDescription = getHeaderDescription({
    hasPublishedStructure: hasLivePublishedStructure,
    isDraftCycleActive: draftCycleActive,
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
      await onPublish({ expectedVersion: setupState.version });
      setPublishDialogOpen(false);
      await refetchReadiness();
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
      await onReopen({ expectedVersion: setupState.version });
      await refetchReadiness();
      toast.success("Draft reopened", {
        description: "The structure can be edited again in Draft Structure.",
      });
    } catch (error) {
      setLocalError(getErrorMessage(error));
    }
  };

  const isPublishing = setupTransitionKind === "publishing";
  const isReopening = setupTransitionKind === "reopening";
  const liveUnitCount = publishedOrgUnits?.length ?? null;
  const liveRootUnitCount =
    publishedOrgUnits?.filter((orgUnit) => !orgUnit.parentStableKey).length ??
    null;

  const publishDisabled =
    phase === "structurallyGoverned"
      ? isPublishing
      : !draftCycleActive ||
        isReadinessLoading ||
        !isReadyForPublish ||
        isPublishing;
  const reopenDisabled = !canReopenLiveDraft || isReopening;

  const summaryLine =
    shouldLoadPublishedOrgUnits &&
    liveUnitCount !== null &&
    liveRootUnitCount !== null
      ? formatStructureCounts(liveUnitCount, liveRootUnitCount)
      : getSetupSummaryLine({
          hasDraftUnits,
          unitCount: readiness?.totalUnitCount ?? 0,
          rootUnitCount: readiness?.rootUnitCount ?? 0,
          blockingIssueCount,
          warningCount,
        });

  const readinessStatusLabel = getReadinessStatusLabel({
    hasPublishedStructure: hasLivePublishedStructure,
    isDraftCycleActive: draftCycleActive,
    requiresRepublish: setupState.requiresRepublish,
    hasDraftUnits,
    blockingIssueCount,
    warningCount,
    isReadyForApproval: isReadyForPublish,
  });

  const readinessSummary = getReadinessSummary({
    hasPublishedStructure: hasLivePublishedStructure,
    isDraftCycleActive: draftCycleActive,
    requiresRepublish: setupState.requiresRepublish,
    hasDraftUnits,
    blockingIssueCount,
    warningCount,
    isReadyForApproval: isReadyForPublish,
  });

  const readinessStatusVariant = hasBlockingIssues
    ? "destructive"
    : hasWarnings ||
        isReadyForPublish ||
        setupState.requiresRepublish ||
        isCoreUnlocked
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
        onClick: () => router.push(draftStructureHref),
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
  } else if (draftCycleActive) {
    const showPublishAction =
      !isTenantContextReadOnly &&
      (isReadyForPublish || setupState.requiresRepublish);
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
          label: setupState.requiresRepublish
            ? "Publish changes"
            : "Publish structure",
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

      {localError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Setup could not be updated</AlertTitle>
          <AlertDescription>{localError}</AlertDescription>
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
                      Draft changes are underway.{" "}
                      <Link
                        href={draftStructureHref}
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        Review it here
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
                    <p className="text-sm text-muted-foreground">
                      {summaryLine}
                    </p>
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
              {isPublishing ? "Publishing..." : "Publish structure"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
