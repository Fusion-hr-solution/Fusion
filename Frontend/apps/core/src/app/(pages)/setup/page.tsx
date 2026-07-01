"use client";

export const dynamic = "force-dynamic";

import { canAccessCoreSetup, useAuth } from "@repo/auth";
import { useTenantContext } from "@/shell/tenant-context/core-tenant-context-provider";
import { buildTenantContextHref } from "@/lib/tenant-navigation";
import {
  PageContainer,
  PageHeader,
  PageError,
  PagePermissionNotice,
} from "@repo/ds/shell";
import {
  SetupWorkspace,
  type SetupWorkspaceProps,
} from "@/features/setup/components/setup-workspace";
import { useCoreSetupAccess } from "@/shell/setup-access";
import { useSetupReadiness } from "@/features/setup/api/use-setup";
import { SetupPageSkeleton } from "@/features/setup/components/setup-workspace";

export default function SetupPage() {
  const { user } = useAuth();
  const { tenantId, tenantSlug } = useTenantContext();
  const isTenantContextReadOnly = !!tenantId;
  const canAccess = canAccessCoreSetup(user) || isTenantContextReadOnly;

  const {
    setupState,
    setupError,
    isSetupStateLoading: isSetupLoading,
    setupTransitionKind,
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
      <PageContainer width="wide" className="space-y-6">
        <PageHeader
          title={setupStarted ? "Setup summary" : "Setup"}
          description="Tenant HR administrators manage setup."
        />
        <PagePermissionNotice
          title="Setup is not available for this role"
          description="Contact a tenant HR administrator."
        />
      </PageContainer>
    );
  }

  if (isSetupLoading && !setupState) {
    return <SetupPageSkeleton />;
  }

  if (setupError && !setupState) {
    return (
      <PageContainer width="wide" className="space-y-6">
        <PageHeader
          title={setupStarted ? "Setup summary" : "Setup"}
          description="The review page is available after the setup state loads."
        />
        <PageError
          title="Setup could not be loaded"
          description={setupError.message}
          onRetry={() => refreshSetupAccess()}
        />
      </PageContainer>
    );
  }

  if (!setupState) {
    return <SetupPageSkeleton />;
  }

  const dashboardHref = buildTenantContextHref("/", tenantId, tenantSlug);
  const draftStructureHref = buildTenantContextHref(
    "/setup/draft-structure",
    tenantId,
    tenantSlug
  );
  const importEmployeesHref = buildTenantContextHref(
    "/employees/import",
    tenantId,
    tenantSlug
  );

  const workspaceProps: SetupWorkspaceProps = {
    setupState,
    readiness,
    readinessError,
    isReadinessLoading,
    refetchReadiness,
    isTenantContextReadOnly,
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
