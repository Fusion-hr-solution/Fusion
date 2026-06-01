"use client";

import { AlertCircle, ClipboardList } from "lucide-react";
import { canAccessCoreSetup, useAuth } from "@repo/auth";
import { EmptyState } from "@repo/ui";
import { useTenantContext } from "@/shell/tenant-context/core-tenant-context-provider";
import { buildTenantContextHref } from "@/lib/tenant-navigation";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  SetupWorkspace,
  type SetupWorkspaceProps,
} from "@/features/setup/components/setup-workspace";
import { useCoreSetupAccess } from "@/shell/setup-access";
import { useSetupReadiness } from "@/features/setup/api/use-setup";
import { SetupPageSkeleton } from "@/features/setup/components/setup-workspace";

export default function SetupPage() {
  const { user } = useAuth();
  const { tenantId } = useTenantContext();
  const isTenantContextReadOnly = !!tenantId;
  const canAccess = canAccessCoreSetup(user) || isTenantContextReadOnly;

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
  const draftCycleActive = setupState?.isDraftCycleActive ?? false;

  const {
    data: readiness,
    error: readinessError,
    isLoading: isReadinessLoading,
    refetch: refetchReadiness,
  } = useSetupReadiness(canAccess && setupStarted && draftCycleActive);

  if (!canAccess) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          title={setupStarted ? "Setup summary" : "Setup"}
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
          title={setupStarted ? "Setup summary" : "Setup"}
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

  const dashboardHref = buildTenantContextHref("/", tenantId);
  const draftStructureHref = buildTenantContextHref(
    "/setup/draft-structure",
    tenantId
  );
  const importEmployeesHref = buildTenantContextHref(
    "/employees/import",
    tenantId
  );

  const workspaceProps: SetupWorkspaceProps = {
    setupState,
    readiness,
    readinessError,
    isReadinessLoading,
    refetchReadiness,
    isTenantContextReadOnly,
    onStartSetup: startSetup,
    onPublish: publishSetup,
    onReopen: reopenSetup,
    dashboardHref,
    draftStructureHref,
    importEmployeesHref,
    canAccess,
    isSetupLoading,
    setupError,
    setupTransitionKind,
    refreshSetupAccess,
  };

  return <SetupWorkspace {...workspaceProps} />;
}
