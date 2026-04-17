"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Flag,
  Rocket,
  ShieldCheck,
} from "lucide-react";
import { canAccessCoreSetup, useAuth } from "@repo/auth";
import type { CoreSetupPhase, TenantSetupStateDto } from "@repo/api";
import { EmptyState } from "@repo/ui";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/page-header";
import { useDraftStructureWorkspace } from "./draft-structure/use-draft-structure";
import { SetupStatusBadge } from "./setup-status-badge";
import { useActivateSetup, useSetupState } from "./use-setup";

const SETUP_STEPS: Array<{
  key: Exclude<CoreSetupPhase, "notStarted">;
  title: string;
  description: string;
  icon: typeof Flag;
}> = [
  {
    key: "activated",
    title: "Setup started",
    description: "A protected planning area is ready for the organization structure.",
    icon: Flag,
  },
  {
    key: "structurallyGoverned",
    title: "Structure approved",
    description: "The planned structure has been reviewed and approved.",
    icon: ShieldCheck,
  },
  {
    key: "structurallyPublished",
    title: "Published to live",
    description: "The approved structure has been pushed into the live organization.",
    icon: CheckCircle2,
  },
  {
    key: "operational",
    title: "Go-live complete",
    description: "The tenant is handed off into normal operations.",
    icon: Rocket,
  },
];

function formatTimestamp(value: string | null) {
  if (!value) {
    return "No draft changes yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getPhaseSummary(phase: CoreSetupPhase | undefined) {
  switch (phase) {
    case "activated":
      return {
        title: "Continue shaping the organization structure",
        description:
          "The structure is still in a protected working draft. Keep building manually or import the official template and review it before anything goes live.",
      };
    case "structurallyGoverned":
      return {
        title: "The structure is approved and waiting for publication",
        description:
          "The planning work is in good shape. The next step is the formal publish step that moves the approved structure into the live organization.",
      };
    case "structurallyPublished":
      return {
        title: "The structure is live, but setup is not fully finished",
        description:
          "The organization structure has been published. Final setup activities still need to be completed before the tenant is considered fully live.",
      };
    case "operational":
      return {
        title: "Setup is complete and the workspace stays available",
        description:
          "The tenant is live. Admins can still return to the organization structure area later for controlled draft changes without changing the live structure immediately.",
      };
    default:
      return {
        title: "Start with the organization structure",
        description:
          "Setup begins by shaping the organization structure before later approval, publication, and go-live activities. You can start once and return as needed.",
      };
  }
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
  const currentIndex = stepOrder.indexOf(data.currentPhase as Exclude<CoreSetupPhase, "notStarted">);

  if (data.completedSteps.includes(stepKey) || currentIndex > stepIndex) {
    return "complete" as const;
  }

  if (currentIndex === stepIndex) {
    return "current" as const;
  }

  return "upcoming" as const;
}

export default function SetupPage() {
  const { user } = useAuth();
  const canAccess = canAccessCoreSetup(user);
  const { data, error, isLoading, refetch } = useSetupState();
  const [localError, setLocalError] = useState<string | null>(null);
  const workspaceEnabled = !!data && !data.canStartSetup;
  const {
    data: workspace,
    error: workspaceError,
    isLoading: isWorkspaceLoading,
  } = useDraftStructureWorkspace(workspaceEnabled);

  const activateSetup = useActivateSetup({
    onSuccess: () => {
      setLocalError(null);
      void refetch();
    },
  });

  useEffect(() => {
    if (activateSetup.error) {
      setLocalError(activateSetup.error.message);
    }
  }, [activateSetup.error]);

  if (!canAccess) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          title="Organization Setup"
          description="Core setup is currently limited to HR administrators and platform operators in tenant context."
        />
        <EmptyState
          icon={ClipboardList}
          title="Setup is not available for this role"
          description="Ask a tenant HR administrator or platform administrator to start and manage tenant setup."
        />
      </div>
    );
  }

  const progressValue = data
    ? Math.round((data.currentStep / Math.max(data.totalSteps, 1)) * 100)
    : 0;
  const hasDraftUnits = (workspace?.unitCount ?? 0) > 0;
  const phaseSummary = getPhaseSummary(data?.currentPhase);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Organization Setup"
        description={
          data?.canStartSetup
            ? "Start setup once, then move into the organization structure area where the real work happens."
            : "Track where setup stands, jump back into the organization structure, and see what still has to happen before go-live."
        }
      />

      {(error || localError || workspaceError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Setup could not be loaded</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{localError ?? error?.message ?? workspaceError?.message}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {data?.canStartSetup ? (
        <>
          <Card className="overflow-hidden">
            <div className="grid gap-0 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="border-b p-6 xl:border-r xl:border-b-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Before go-live
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                  Set up the organization structure first
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Start setup once, then shape the organization manually or import
                  the official template. Everything stays in a protected working
                  draft until later approval and publication.
                </p>

                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  <SummaryTile
                    title="Build it manually"
                    description="Add top-level units, create children in place, and refine the hierarchy step by step."
                  />
                  <SummaryTile
                    title="Import the official template"
                    description="Download the structure template, fill it offline, and review the result before replacing the draft."
                  />
                  <SummaryTile
                    title="Keep live data safe"
                    description="Nothing on this flow changes the live organization immediately."
                  />
                </div>
              </div>

              <div className="space-y-6 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Current status</p>
                    <div className="mt-2">
                      {data ? <SetupStatusBadge status={data.currentPhase} /> : null}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Progress</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight">
                      {isLoading
                        ? "..."
                        : `${data?.currentStep ?? 0}/${data?.totalSteps ?? 4}`}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Setup progress</span>
                    <span>{progressValue}%</span>
                  </div>
                  <Progress value={progressValue} />
                </div>

                <div className="rounded-xl border bg-muted/20 p-4">
                  <p className="text-sm font-medium">Next step</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {isLoading ? "Loading setup state..." : data?.nextAction ?? "Start setup"}
                  </p>
                </div>

                <Button
                  className="w-full"
                  onClick={() => {
                    setLocalError(null);
                    activateSetup.mutate();
                  }}
                  disabled={isLoading || activateSetup.isLoading}
                >
                  Start organization setup
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Road to go-live</CardTitle>
              <CardDescription>
                Structure comes first. People data import starts after this roadmap.
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
        </>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="overflow-hidden">
              <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="border-b p-6 lg:border-r lg:border-b-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Current focus
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {data ? <SetupStatusBadge status={data.currentPhase} /> : null}
                    <span className="text-sm text-muted-foreground">
                      {progressValue}% complete
                    </span>
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                    {phaseSummary.title}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    {phaseSummary.description}
                  </p>

                  <div className="mt-6 space-y-2">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Setup progress</span>
                      <span>
                        {isLoading
                          ? "..."
                          : `${data?.currentStep ?? 0}/${data?.totalSteps ?? 4}`}
                      </span>
                    </div>
                    <Progress value={progressValue} />
                  </div>

                  <div className="mt-6 rounded-xl border bg-muted/20 p-4">
                    <p className="text-sm font-medium">Next step</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {data?.nextAction ?? "Continue setup"}
                    </p>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <Button asChild>
                      <Link href="/setup/draft-structure">
                        Continue organization structure
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="space-y-4 bg-muted/10 p-6">
                  <p className="text-sm font-medium">At a glance</p>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                    <MetricTile
                      label="Units planned"
                      value={isWorkspaceLoading ? "..." : String(workspace?.unitCount ?? 0)}
                      description={`Top-level units: ${isWorkspaceLoading ? "..." : workspace?.rootUnitCount ?? 0}`}
                    />
                    <MetricTile
                      label="Unit types"
                      value={isWorkspaceLoading
                        ? "..."
                        : String(workspace?.draftStructureSchema.orgUnitKinds.length ?? 0)}
                      description="The same set of approved unit types is used for manual editing and template import."
                    />
                    <MetricTile
                      label="Last updated"
                      value={formatTimestamp(workspace?.lastModifiedAt ?? null)}
                      description="The working structure stays separate from the live organization until later steps publish it."
                    />
                    <MetricTile
                      label="Working area"
                      value={hasDraftUnits ? "Ready" : "Empty"}
                      description={hasDraftUnits
                        ? "The organization structure already has planned units waiting in the draft."
                        : "No units have been planned yet. Start manually or import the official template."}
                    />
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Road to go-live</CardTitle>
                <CardDescription>
                  Structure is the current slice. People data import comes after this roadmap.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {SETUP_STEPS.map((step) => (
                  <SetupMilestoneRow
                    key={step.key}
                    step={step}
                    state={getStepState(step.key, data)}
                  />
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <SummaryTile
              title="Build it manually"
              description="Add top-level units, place children where they belong, and use the side panel for supporting details."
            />
            <SummaryTile
              title="Import the official template"
              description="Download the template from the structure area, upload the completed file, review issues, and replace the working draft only when it is ready."
            />
            <SummaryTile
              title="Keep the live organization safe"
              description="Everything stays in a working draft until later approval and publication steps make the change live."
            />
          </div>
        </>
      )}
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
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
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

function SetupMilestoneRow({
  step,
  state,
}: {
  step: (typeof SETUP_STEPS)[number];
  state: "complete" | "current" | "upcoming";
}) {
  const Icon = step.icon;
  const tone =
    state === "complete"
      ? "border-emerald-200 bg-emerald-50"
      : state === "current"
        ? "border-blue-200 bg-blue-50"
        : "border-border bg-background";
  const statusLabel =
    state === "complete" ? "Done" : state === "current" ? "Now" : "Later";

  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-8 items-center justify-center rounded-full bg-background text-muted-foreground">
            <Icon className="size-4" />
          </div>
          <div>
            <p className="font-medium">{step.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
          </div>
        </div>
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {statusLabel}
        </span>
      </div>
    </div>
  );
}
