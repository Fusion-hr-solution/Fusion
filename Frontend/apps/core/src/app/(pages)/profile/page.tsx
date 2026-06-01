"use client";

import { User } from "lucide-react";
import {
  canManageCoreAccess,
  canManageCoreEmployees,
  useAuth,
} from "@repo/auth";
import { EmptyState } from "@repo/ui";
import { CorePageLoadingState } from "@/components/core-page-loading-state";
import { PageHeader } from "@/components/page-header";
import { useTenantContext } from "@/shell/tenant-context/core-tenant-context-provider";
import { useTenantSettings } from "@/features/settings/api/use-tenant-settings";
import { useEmployeeFieldPolicy } from "@/features/employees/shared/employee-field-visibility";
import {
  EmployeeProfileWorkspace,
  type EmployeeProfileWorkspaceProps,
} from "@/features/employees/profile/employee-profile-workspace";
import {
  useEmployeeProfile,
  useEmployeeReportingLines,
} from "../employees/use-employees";

export default function MyProfilePage() {
  const { user, isLoading: authLoading } = useAuth();
  const { tenantId } = useTenantContext();
  const employeeId = user?.employeeId ?? null;
  const isTenantContextReadOnly = !!tenantId;
  const canManageEmployee =
    canManageCoreEmployees(user) && !isTenantContextReadOnly;
  const canManageAccess = canManageCoreAccess(user) && !isTenantContextReadOnly;
  const canViewProfile = !!employeeId;

  const fieldPolicy = useEmployeeFieldPolicy(canViewProfile, "employee");
  const { data: settings } = useTenantSettings(canViewProfile);

  const {
    data: profile,
    error,
    isLoading,
  } = useEmployeeProfile(canViewProfile ? employeeId : null);

  const { data: reportingLines } =
    useEmployeeReportingLines(canViewProfile ? employeeId : null);

  if (authLoading) {
    return (
      <CorePageLoadingState
        title="My Profile"
        description="Loading profile."
        message="Loading your profile..."
        variant="summary-list"
      />
    );
  }

  if (!employeeId) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader title="My Profile" description="No linked employee record." />
        <EmptyState
          icon={User}
          title="No linked employee profile"
          description="Contact a tenant HR administrator to link your record."
        />
      </div>
    );
  }

  if (isLoading && !profile && !error) {
    return (
      <CorePageLoadingState
        title="My Profile"
        description="Loading profile."
        message="Loading your profile..."
        variant="summary-list"
      />
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <EmptyState
          icon={User}
          title="Your profile could not be found"
          description="Your linked employee profile is not available right now."
        />
      </div>
    );
  }

  if (!profile) return null;

  const canEditOwnPreferredName =
    user?.employeeId === profile.id &&
    settings?.selfService.canEditPreferredName !== false;
  const canEditOwnPhone =
    user?.employeeId === profile.id &&
    settings?.selfService.canEditPhone !== false;

  const workspaceProps: EmployeeProfileWorkspaceProps = {
    profile,
    reportingLines,
    fieldPolicy,
    user,
    employeeId,
    isSelfRoute: true,
    isSelfView: true,
    isTenantContextReadOnly,
    canManageEmployee,
    canManageAccess,
    canEditOwnPreferredName,
    canEditOwnPhone,
  };

  return <EmployeeProfileWorkspace {...workspaceProps} />;
}
