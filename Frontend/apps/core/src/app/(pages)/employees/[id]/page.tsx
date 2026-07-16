"use client";

export const dynamic = "force-dynamic";

import { useParams } from "next/navigation";
import { User } from "lucide-react";
import {
  canAccessCoreAccess,
  canAccessCoreOrgChart,
  canManageCoreAccess,
  canManageCoreEmployees,
  canManageCoreReporting,
  useAuth,
} from "@repo/auth";
import {
  PageContainer,
  PageEmpty,
  PageError,
  PagePermissionNotice,
} from "@repo/ds/shell";
import { EmployeeProfilePageSkeleton } from "@/shell/route-skeletons";
import { useTenantContext } from "@/shell/tenant-context/core-tenant-context-provider";
import { useBreadcrumbLabel } from "@/shell/breadcrumb-overrides";
import { canAccessEmployeeProfile } from "@/lib/employee-roster-access";
import { useTenantSettings } from "@/features/settings/api/use-tenant-settings";
import { useEmployeeFieldPolicy } from "@/features/employees/shared/employee-field-visibility";
import {
  EmployeeProfileWorkspace,
  type EmployeeProfileWorkspaceProps,
} from "@/features/employees/profile/employee-profile-workspace";
import {
  useEmployeeDetails,
  useEmployeeReportingLines,
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

  const effectiveEmployeeKey =
    (canViewProfile || isTenantContextReadOnly) && employeeKey
      ? employeeKey
      : null;

  const {
    data: details,
    error,
    isLoading,
  } = useEmployeeDetails(effectiveEmployeeKey);

  const { data: reportingLines } =
    useEmployeeReportingLines(effectiveEmployeeKey);
  const isLoadedOwnProfile = !!details && user?.employeeId === details.id;
  const fieldAudience =
    canManageEmployee || isTenantContextReadOnly
      ? "hrAdmin"
      : isLoadedOwnProfile
        ? "employee"
        : "manager";
  const fieldPolicy = useEmployeeFieldPolicy(
    canViewProfile || isTenantContextReadOnly,
    fieldAudience
  );
  const { data: settings } = useTenantSettings(
    canViewProfile || isTenantContextReadOnly
  );

  // Register employee name in the top breadcrumb (Core > Employees > Jane Smith)
  useBreadcrumbLabel(employeeKey ?? "", details?.fullName);

  const isInitialLoading =
    (canViewProfile || isTenantContextReadOnly) &&
    isLoading &&
    !details &&
    !error;

  if (isInitialLoading) {
    return <EmployeeProfilePageSkeleton />;
  }

  const isViewable = canViewProfile || isTenantContextReadOnly;

  if (!isViewable) {
    return (
      <PageContainer width="wide" className="space-y-6">
        <PagePermissionNotice
          title="Employee profile is not available for this role"
          description="Contact a tenant HR administrator."
        />
      </PageContainer>
    );
  }

  if (error) {
    const isNotFound =
      "status" in error && (error as { status?: number }).status === 404;
    const isForbidden =
      "status" in error && (error as { status?: number }).status === 403;

    return (
      <PageContainer width="wide" className="space-y-6">
        {isNotFound || isForbidden ? (
          <PageEmpty
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
          <PageError
            title="Failed to load employee profile"
            description="Could not load profile. Try again in a moment."
          />
        )}
      </PageContainer>
    );
  }

  if (!details) {
    return (
      <PageContainer width="wide" className="space-y-6">
        <PageEmpty
          icon={User}
          title="Employee profile unavailable"
          description="This employee profile is not available right now."
        />
      </PageContainer>
    );
  }

  const canEditOwnPreferredName =
    user?.employeeId === details.id &&
    settings?.selfService.canEditPreferredName !== false;
  const canEditOwnPhone =
    user?.employeeId === details.id &&
    settings?.selfService.canEditPhone !== false;

  const workspaceProps: EmployeeProfileWorkspaceProps = {
    details,
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
