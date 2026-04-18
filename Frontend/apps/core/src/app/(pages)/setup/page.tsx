"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
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
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  useReopenStructure,
  useSetupReadiness,
  useSetupState,
} from "./use-setup";

const SETUP_STEPS: Array<{
  key: Exclude<CoreSetupPhase, "notStarted">;
  title: string;
  description: string;
  icon: typeof Flag;
}> = [
  {
    key: "activated",
    title: "Setup started",
    description: "The draft workspace is open and protected from the live structure.",
    icon: Flag,
  },
  {
    key: "structurallyGoverned",
    title: "Structure approved",
    description: "The draft has been reviewed and locked for the next step.",
    icon: ShieldCheck,
  },
  {
    key: "structurallyPublished",
    title: "Published to live",
    description: "The approved structure has been applied to the live organization.",
    icon: CheckCircle2,
  },
  {
    key: "operational",
    title: "Go-live complete",
    description: "Setup is complete and the tenant is running normally.",
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

function getStepState(
  stepKey: Exclude<CoreSetupPhase, "notStarted">,
  data: TenantSetupStateDto | undefined
) {
  if (!data || data.canStartSetup) {
    return "upcoming" as const;
  }

  const stepOrder = SETUP_STEPS.map((step) => step.key);
  const stepIndex = stepOrder.indexOf(stepKey);
  const currentIndex = stepOrder.indexOf(
    data.currentPhase as Exclude<CoreSetupPhase, "notStarted">
  );

  if (data.completedSteps.includes(stepKey) || currentIndex > stepIndex) {
    return "complete" as const;
  }

  if (currentIndex === stepIndex) {
    return "current" as const;
  }

  return "upcoming" as const;
}

function getReviewCopy(phase: CoreSetupPhase) {
  switch (phase) {
    case "activated":
      return {
        title: "Review the draft and approve it when ready",
        description:
          "Approval freezes the draft until it is reopened. Use it here or directly from the draft workspace once the remaining issues are clear.",
      };
    case "structurallyGoverned":
      return {
        title: "The structure is approved",
        description:
          "The draft is now read-only. Reopen it only if more changes are needed before publish.",
      };
    case "structurallyPublished":
      return {
        title: "The approved structure has been published",
        description:
          "The organization structure is already live. Finish the remaining setup work to reach full operation.",
      };
    case "operational":
      return {
        title: "Setup is complete",
        description:
          "The tenant is live. The setup roadmap is complete and the structure has already moved through governance.",
      };
    default:
      return {
        title: "Start setup to open the draft workspace",
        description:
          "Create the first draft before review and approval can begin.",
      };
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
  if (activity.activityType === "approved") {
    return {
      title: "Draft approved",
      description: `${activity.actorFullName} approved the structure`,
    };
  }

  return {
    title: "Draft reopened",
    description: `${activity.actorFullName} reopened the structure`,
  };
}

export default function SetupPage() {
  const router = useRouter();
  const { user } = useAuth();
  const canAccess = canAccessCoreSetup(user);
  const [localError, setLocalError] = useState<string | null>(null);

  const {
    data: setupState,
    error: setupError,
    isLoading: isSetupLoading,
    refetch: refetchSetup,
  } = useSetupState();
  const setupStarted = !!setupState && !setupState.canStartSetup;
  const {
    data: readiness,
    error: readinessError,
    isLoading: isReadinessLoading,
    refetch: refetchReadiness,
  } = useSetupReadiness(setupStarted);

  const refreshGovernanceData = () => {
    void refetchSetup();
    if (setupStarted) {
      void refetchReadiness();
    }
  };

  const activateSetup = useActivateSetup({
    onSuccess: () => {
      setLocalError(null);
      refreshGovernanceData();
    },
  });
  const approveStructure = useApproveStructure({
    onSuccess: () => {
      setLocalError(null);
      refreshGovernanceData();
    },
  });
  const reopenStructure = useReopenStructure({
    onSuccess: () => {
      setLocalError(null);
      refreshGovernanceData();
    },
  });

  if (!canAccess) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          title="Organization Setup"
          description="Core setup is limited to HR administrators and platform operators in tenant context."
        />
        <EmptyState
          icon={ClipboardList}
          title="Setup is not available for this role"
          description="Ask a tenant HR administrator or platform administrator to manage setup."
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
          title="Organization Setup"
          description="The review page is available after the setup state loads."
        />
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Setup could not be loaded</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{setupError.message}</span>
            <Button variant="outline" size="sm" onClick={() => refetchSetup()}>
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

  const progressValue = setupState
    ? Math.round(
        (setupState.currentStep / Math.max(setupState.totalSteps, 1)) * 100
      )
    : 0;
  const reviewCopy = getReviewCopy(setupState?.currentPhase ?? "notStarted");
  const pageError = localError ?? null;

  const handleStartSetup = async () => {
    setLocalError(null);

    try {
      await activateSetup.mutateAsync();
      router.replace("/setup/draft-structure");
    } catch (error) {
      if (error instanceof ApiError) {
        setLocalError(error.errors.join(", "));
        return;
      }

      if (error instanceof Error) {
        setLocalError(error.message);
        return;
      }

      setLocalError("An unexpected error occurred.");
    }
  };

  const handleApprove = async () => {
    if (setupState.version == null) {
      setLocalError("The latest setup version is required before approval.");
      return;
    }

    setLocalError(null);

    try {
      await approveStructure.mutateAsync({ expectedVersion: setupState.version });
    } catch (error) {
      if (error instanceof ApiError) {
        setLocalError(error.errors.join(", "));
        return;
      }

      if (error instanceof Error) {
        setLocalError(error.message);
        return;
      }

      setLocalError("An unexpected error occurred.");
    }
  };

  const handleReopen = async () => {
    if (setupState.version == null) {
      setLocalError("The latest setup version is required before reopening.");
      return;
    }

    setLocalError(null);

    try {
      await reopenStructure.mutateAsync({ expectedVersion: setupState.version });
    } catch (error) {
      if (error instanceof ApiError) {
        setLocalError(error.errors.join(", "));
        return;
      }

      if (error instanceof Error) {
        setLocalError(error.message);
        return;
      }

      setLocalError("An unexpected error occurred.");
    }
  };

  if (setupState?.canStartSetup) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          title="Organization Setup"
          description="Start with the draft structure. When the first pass is ready, approve it there or from this review page."
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
                <span className="text-sm text-muted-foreground">0% complete</span>
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                Open the draft workspace
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Build the organization structure in a protected draft first. Nothing touches the live structure until later steps are complete.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <SummaryTile
                  title="Build the first draft"
                  description="Add top-level units, place child units, and shape the hierarchy in one workspace."
                />
                <SummaryTile
                  title="Import when useful"
                  description="Use the template if the structure already exists outside the system."
                />
                <SummaryTile
                  title="Review before lock"
                  description="Approve from the draft flow or from this page when the first pass is ready."
                />
              </div>
            </div>

            <div className="space-y-6 p-6">
              <MetricTile label="Progress" value="0/4" hint="Setup roadmap" />
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-sm font-medium">What happens next</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Starting setup takes you straight into the draft structure workspace.
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

  const blockingIssueCount = readiness?.blockingIssueCount ?? 0;
  const warningCount = readiness?.warningCount ?? 0;
  const approvalDisabled =
    setupState?.currentPhase !== "activated" ||
    isReadinessLoading ||
    !readiness?.isReadyForApproval ||
    approveStructure.isLoading;
  const reopenDisabled =
    setupState?.currentPhase !== "structurallyGoverned" || reopenStructure.isLoading;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Organization Setup"
        description="Review the draft structure, clear the remaining issues, and lock it when ready."
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
              Governance review
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SetupStatusBadge status={setupState.currentPhase} />
              <span className="text-sm text-muted-foreground">{progressValue}% complete</span>
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              {reviewCopy.title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {reviewCopy.description}
            </p>

            {setupState.approvedAt ? (
              <div className="mt-6 rounded-xl border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">Approved</Badge>
                  {setupState.isApprovedInPlatformAssistMode ? (
                    <Badge variant="outline">Platform assisted</Badge>
                  ) : null}
                </div>
                <p className="mt-3 text-sm font-medium">
                  {setupState.approvedByFullName ?? "Approval recorded"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {setupState.approvedByRole ?? "Reviewer"} • {formatTimestamp(setupState.approvedAt)}
                </p>
              </div>
            ) : (
              <div className="mt-6 rounded-xl border bg-muted/20 p-4">
                <div className="flex items-start gap-3">
                  <LockKeyhole className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Approval lock</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      After approval, the draft becomes read-only until it is reopened from this page.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              <Button onClick={() => router.push("/setup/draft-structure")}>
                {setupState.currentPhase === "structurallyGoverned"
                  ? "View draft workspace"
                  : "Open draft workspace"}
              </Button>
              {setupState.currentPhase === "activated" ? (
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
              {setupState.currentPhase === "structurallyGoverned" ? (
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
            </div>
          </div>

          <div className="grid gap-4 p-6 sm:grid-cols-2">
            <MetricTile
              label="Progress"
              value={`${setupState.currentStep}/${setupState.totalSteps}`}
              hint="Setup roadmap"
            />
            <MetricTile
              label="Units in draft"
              value={isReadinessLoading && !readiness ? "..." : String(readiness?.totalUnitCount ?? 0)}
              hint={`Top-level units: ${readiness?.rootUnitCount ?? 0}`}
            />
            <MetricTile
              label="Blocking issues"
              value={isReadinessLoading && !readiness ? "..." : String(blockingIssueCount)}
              hint={blockingIssueCount === 0 ? "Ready for approval" : "Must be cleared first"}
            />
            <MetricTile
              label="Warnings"
              value={isReadinessLoading && !readiness ? "..." : String(warningCount)}
              hint={warningCount === 0 ? "No open warnings" : "Review before approval"}
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
              Approval is available only when the draft has no blocking issues.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {readinessError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Readiness could not be loaded</AlertTitle>
                <AlertDescription className="flex items-center justify-between gap-4">
                  <span>{readinessError.message}</span>
                  <Button variant="outline" size="sm" onClick={() => refetchReadiness()}>
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
                  isReadyForApproval={readiness.isReadyForApproval}
                  blockingIssueCount={readiness.blockingIssueCount}
                  warningCount={readiness.warningCount}
                />

                {readiness.blockingIssues.length > 0 ? (
                  <IssueSection
                    title="Blocking issues"
                    description="These must be cleared before approval."
                    issues={readiness.blockingIssues}
                  />
                ) : null}

                {readiness.warnings.length > 0 ? (
                  <IssueSection
                    title="Warnings"
                    description="These do not block approval, but they should be reviewed."
                    issues={readiness.warnings}
                  />
                ) : null}

                {readiness.blockingIssues.length === 0 && readiness.warnings.length === 0 ? (
                  <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                    The draft is clean. You can approve it when you are ready.
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
              Approval and reopen events are recorded here.
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
                              <Badge variant="outline">Platform assisted</Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {activityCopy.description}
                          </p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {activity.actorRole} • {formatTimestamp(activity.occurredAt)}
                          </p>
                        </div>
                      </div>
                      {index < setupState.recentActivities.length - 1 ? <Separator /> : null}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <RoadmapCard data={setupState} />
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
  isReadyForApproval,
  blockingIssueCount,
  warningCount,
}: {
  setupState: TenantSetupStateDto;
  isReadyForApproval: boolean;
  blockingIssueCount: number;
  warningCount: number;
}) {
  const isApproved = setupState.currentPhase === "structurallyGoverned";

  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={isReadyForApproval ? "secondary" : "destructive"}>
          {isApproved
            ? "Approved"
            : isReadyForApproval
              ? "Ready for approval"
              : "Needs attention"}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {blockingIssueCount} blocking issue{blockingIssueCount === 1 ? "" : "s"}
          {warningCount > 0 ? ` • ${warningCount} warning${warningCount === 1 ? "" : "s"}` : ""}
        </span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {isApproved
          ? "The draft is locked. Reopen it from this page if more changes are needed."
          : isReadyForApproval
            ? "The draft meets the review checks. You can approve it now."
            : "Keep working in the draft workspace until the blocking issues are cleared."}
      </p>
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
          <div key={group.category} className="rounded-xl border bg-muted/20 p-4">
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
        <CardTitle>Road to go-live</CardTitle>
        <CardDescription>
          Structure comes first. Later setup work follows after approval and publish.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
    <div className="rounded-xl border p-4">
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