"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { AlertCircle, ClipboardList } from "lucide-react";
import { canAccessCoreSetup, useAuth } from "@repo/auth";
import { EmptyState } from "@repo/ui";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/page-header";
import { SetupStatusBadge } from "./setup-status-badge";
import { useActivateSetup, useSetupState } from "./use-setup";

const STEP_LABELS: Record<string, string> = {
  activated: "Activate setup",
  structurallyGoverned: "Govern structure",
  structurallyPublished: "Publish structure",
  operational: "Operational handoff",
};

export default function SetupPage() {
  const router = useRouter();
  const { user } = useAuth();
  const canAccess = canAccessCoreSetup(user);
  const { data, error, isLoading, refetch } = useSetupState();
  const [localError, setLocalError] = useState<string | null>(null);

  const activateSetup = useActivateSetup({
    onSuccess: (nextState) => {
      startTransition(() => {
        void refetch();
        if (nextState.canResumeSetup) {
          router.push("/setup/draft-structure");
        }
      });
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
          title="Setup"
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

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Setup"
        description="Activate and track the tenant setup lifecycle. Draft structure remains a Setup-owned next step for preparation and later correction around the import-led onboarding path."
      />

      {(error || localError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Setup state could not be loaded</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{localError ?? error?.message}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tenant setup lifecycle</CardTitle>
          <CardDescription>
            Slice 1 establishes the explicit setup backbone and start or resume
            behavior. Draft structure, governance, and publication arrive in
            later slices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
              <span>Milestones completed</span>
              <span>{progressValue}%</span>
            </div>
            <Progress value={progressValue} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-sm font-medium">Completed</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {(data?.completedSteps ?? []).length > 0 ? (
                  data?.completedSteps.map((step) => (
                    <li key={step}>{STEP_LABELS[step] ?? step}</li>
                  ))
                ) : (
                  <li>None yet</li>
                )}
              </ul>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-sm font-medium">Pending</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {(data?.pendingSteps ?? []).map((step) => (
                  <li key={step}>{STEP_LABELS[step] ?? step}</li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Next action</p>
            <p className="text-sm text-muted-foreground">
              {isLoading
                ? "Loading setup state..."
                : (data?.nextAction ?? "Start setup")}
            </p>
          </div>
          {data?.canStartSetup ? (
            <Button
              onClick={() => {
                setLocalError(null);
                activateSetup.mutate();
              }}
              disabled={isLoading || activateSetup.isLoading}
            >
              Start Setup
            </Button>
          ) : (
            <Button asChild>
              <Link href="/setup/draft-structure">Open Draft Workspace</Link>
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
