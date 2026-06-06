"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import {
  canAccessCoreAccess,
  canManageCoreAccessProfiles,
  useAuth,
} from "@repo/auth";
import { CorePageLoadingState } from "@/components/core-page-loading-state";
import { useTenantContext } from "@/shell/tenant-context/core-tenant-context-provider";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buildTenantContextHref } from "@/lib/tenant-navigation";
import { AccessWorkspaceNav } from "@/app/(pages)/access/access-workspace-nav";

export default function AccessPeopleWorkspace() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { tenantId, tenantSlug } = useTenantContext();

  const canViewAccess = canAccessCoreAccess(user);
  const canManageProfiles = canManageCoreAccessProfiles(user);
  const profilesHref = buildTenantContextHref(
    "/access/profiles",
    tenantId,
    tenantSlug
  );

  useEffect(() => {
    if (!canViewAccess && canManageProfiles) {
      router.replace(profilesHref);
    }
  }, [canManageProfiles, canViewAccess, profilesHref, router]);

  if (isLoading) {
    return (
      <CorePageLoadingState
        title="Access"
        description="Manage account activation, access profiles, and invitation status."
        message="Loading access workspace"
        variant="workspace"
      />
    );
  }

  if (!canViewAccess && canManageProfiles) {
    return (
      <CorePageLoadingState
        title="Access"
        description="Redirecting to access profiles."
        message="Opening access profiles"
        variant="redirect"
      />
    );
  }

  if (!canViewAccess && !canManageProfiles) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          title="Access"
          description="Manage account activation, access profiles, and invitation status."
        />
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertTitle>Access is restricted</AlertTitle>
          <AlertDescription>
            Your current access profile does not include the Access workspace.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Access"
        description="Manage account activation, access profiles, and invitation status."
      />
      <AccessWorkspaceNav
        active="people"
        showPeople={canViewAccess}
        showProfiles={canManageProfiles}
      />
    </div>
  );
}
