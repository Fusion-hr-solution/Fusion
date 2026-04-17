"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { ApiError } from "@repo/api";
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
  const router = useRouter();
  const { user } = useAuth();
  const canAccess = canAccessCoreSetup(user);
  const { data, error, isLoading, refetch } = useSetupState();
  const [localError, setLocalError] = useState<string | null>(null);

  const activateSetup = useActivateSetup({
    onSuccess: () => {
      setLocalError(null);
      void refetch();
    },
  });

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
  const canStartSetup = data?.canStartSetup ?? true;
  const phaseSummary = getPhaseSummary(data?.currentPhase);
  const setupAlertMessage = localError ?? error?.message ?? null;
  const setupAlertTitle = error
    ? "Setup could not be loaded"
    : "Setup could not be updated";
  const primaryAction = canStartSetup
    ? "Start organization setup"
    : "Open organization structure";

  const handlePrimaryAction = async () => {
    if (!canStartSetup) {
      router.push("/setup/draft-structure");
      return;
    }

    setLocalError(null);

    try {
      await activateSetup.mutateAsync();
      router.replace("/setup/draft-structure");
    } catch (activationError) {
      if (activationError instanceof ApiError) {
        setLocalError(activationError.errors.join(", "));
        return;
      }

      if (activationError instanceof Error) {
        setLocalError(activationError.message);
        return;
      }

      setLocalError("An unexpected error occurred.");
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Organization Setup"
        description="Use this page as a lightweight setup summary. The actual organization planning work happens in the organization structure workspace."
      />

      {setupAlertMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{setupAlertTitle}</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{setupAlertMessage}</span>
            {error ? (
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      )}

      <Card className="overflow-hidden">
        <div className="grid gap-0 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="border-b p-6 xl:border-r xl:border-b-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Setup summary
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {data ? <SetupStatusBadge status={data.currentPhase} /> : null}
              <span className="text-sm text-muted-foreground">{progressValue}% complete</span>
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              {phaseSummary.title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {phaseSummary.description}
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <SummaryTile
                title="Build it manually"
                description="Add top-level units, place children where they belong, and refine the hierarchy in one workspace."
              />
              <SummaryTile
                title="Import the official template"
                description="Download the structure template, fill it offline, then review the staged result before replacing the draft."
              />
              <SummaryTile
                title="Keep live data safe"
                description="Everything stays in a protected working draft until a later approval and publication step pushes it live."
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
                  {isLoading ? "..." : `${data?.currentStep ?? 0}/${data?.totalSteps ?? 4}`}
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
                {isLoading
                  ? "Loading setup state..."
                  : data?.nextAction ?? "Start setup"}
              </p>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-sm font-medium">Workspace</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {canStartSetup
                  ? "Starting setup takes you straight into the organization structure workspace, where the real planning work happens."
                  : "Continue the actual planning work in the organization structure workspace. This page stays a lightweight summary on purpose."}
              </p>
            </div>

            <Button
              className="w-full"
              onClick={() => {
                void handlePrimaryAction();
              }}
              disabled={isLoading || activateSetup.isLoading}
            >
              {primaryAction}
              {!canStartSetup ? <ArrowRight className="size-4" /> : null}
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
