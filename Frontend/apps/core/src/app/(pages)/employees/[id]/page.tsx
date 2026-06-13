"use client";

export const dynamic = "force-dynamic";

import { useParams } from "next/navigation";
import { Users, User } from "lucide-react";
import {
  canAccessCoreAccess,
  canAccessCoreOrgChart,
  canManageCoreAccess,
  canManageCoreEmployees,
  canManageCoreReporting,
  useAuth,
} from "@repo/auth";
import { EmptyState } from "@repo/ui";
import { CorePageLoadingState } from "@/components/core-page-loading-state";
import { useTenantContext } from "@/shell/tenant-context/core-tenant-context-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useBreadcrumbLabel } from "@/shell/breadcrumb-overrides";
import { canAccessEmployeeProfile } from "@/lib/employee-roster-access";
import { useTenantSettings } from "@/features/settings/api/use-tenant-settings";
import { useEmployeeFieldPolicy } from "@/features/employees/shared/employee-field-visibility";
import {
  EmployeeProfileWorkspace,
  type EmployeeProfileWorkspaceProps,
} from "@/features/employees/profile/employee-profile-workspace";
import {
  useEmployeeProfile,
  useEmployeeReportingLines,
  useUpdateMyProfile,
} from "../use-employees";

export default function EmployeeProfilePage() {
  const { user } = useAuth();
  const params = useParams<{ id?: string }>();
  const { tenantId } = useTenantContext();
  const isTenantContextReadOnly = !!tenantId;
  const canManageEmployee =
    canManageCoreEmployees(user) && !isTenantContextReadOnly;
  const canManageReporting =
    canManageCoreReporting(user) && !isTenantContextReadOnly;
  const canManageAccess = canManageCoreAccess(user) && !isTenantContextReadOnly;
  const canViewAccess =
    canAccessCoreAccess(user) || canManageAccess || isTenantContextReadOnly;
  const canUseOrgChart = canAccessCoreOrgChart(user) || isTenantContextReadOnly;
  const canViewProfile = canAccessEmployeeProfile(user);
  const employeeKey =
    typeof params.id === "string" && params.id.trim().length > 0
      ? params.id
      : null;
  const isOwnProfile = !!employeeKey && user?.employeeId === employeeKey;
  const fieldAudience =
    canManageEmployee || isTenantContextReadOnly
      ? "hrAdmin"
      : isOwnProfile
        ? "employee"
        : "manager";
  const fieldPolicy = useEmployeeFieldPolicy(
    canViewProfile || isTenantContextReadOnly,
    fieldAudience
  );
  const { data: settings } = useTenantSettings(
    canViewProfile || isTenantContextReadOnly
  );

  const effectiveEmployeeKey =
    (canViewProfile || isTenantContextReadOnly) && employeeKey
      ? employeeKey
      : null;

  const {
    data: profile,
    error,
    isLoading,
  } = useEmployeeProfile(effectiveEmployeeKey);

  const { data: reportingLines } =
    useEmployeeReportingLines(effectiveEmployeeKey);

  // Register employee name in the top breadcrumb (Core > Employees > Jane Smith)
  useBreadcrumbLabel(employeeKey ?? "", profile?.fullName);

  const isInitialLoading =
    (canViewProfile || isTenantContextReadOnly) &&
    isLoading &&
    !profile &&
    !error;

  if (isInitialLoading) {
    return (
      <CorePageLoadingState
        title="Employee Profile"
        description="Loading employee profile."
        message="Loading employee profile..."
        variant="summary-list"
      />
    );
  }

  const isViewable = canViewProfile || isTenantContextReadOnly;

  if (!isViewable) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <EmptyState
          icon={Users}
          title="Employee profile is not available for this role"
          description="Contact a tenant HR administrator."
        />
      </div>
    );
  }

  if (error) {
    const isNotFound =
      "status" in error && (error as { status?: number }).status === 404;
    const isForbidden =
      "status" in error && (error as { status?: number }).status === 403;

    return (
      <div className="flex flex-col gap-6 p-6">
        {isNotFound || isForbidden ? (
          <EmptyState
            icon={User}
            title={
              isForbidden
                ? "Employee is outside your scope"
                : "Employee not found"
            }
            description={
              isForbidden
                ? "This employee is outside your current Core access scope."
                : "This employee is not available right now."
            }
          />
        ) : (
          <Alert variant="destructive">
            <AlertTitle>Failed to load employee profile</AlertTitle>
            <AlertDescription>
              Could not load profile. Try again in a moment.
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <EmptyState
          icon={User}
          title="Employee profile unavailable"
          description="This employee profile is not available right now."
        />
      </div>
    );
  }

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
    isTenantContextReadOnly,
    canManageEmployee,
    canManageReporting,
    canViewAccess,
    canManageAccess,
    canUseOrgChart,
    canEditOwnPreferredName,
    canEditOwnPhone,
  };

  return <EmployeeProfileWorkspace {...workspaceProps} />;
}
