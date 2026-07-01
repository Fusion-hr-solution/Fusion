"use client";

export const dynamic = "force-dynamic";

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
  PageHeader,
  PageEmpty,
  PageError,
  PageLoading,
} from "@repo/ds/shell";
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
  const canManageReporting =
    canManageCoreReporting(user) && !isTenantContextReadOnly;
  const canManageAccess = canManageCoreAccess(user) && !isTenantContextReadOnly;
  const canViewAccess =
    canAccessCoreAccess(user) || canManageAccess || isTenantContextReadOnly;
  const canUseOrgChart = canAccessCoreOrgChart(user) || isTenantContextReadOnly;
  const canViewProfile = !!employeeId;

  const fieldPolicy = useEmployeeFieldPolicy(canViewProfile, "employee");
  const { data: settings } = useTenantSettings(canViewProfile);

  const {
    data: profile,
    error,
    isLoading,
  } = useEmployeeProfile(canViewProfile ? employeeId : null);

  const { data: reportingLines } = useEmployeeReportingLines(
    canViewProfile ? employeeId : null
  );

  if (authLoading) {
    return (
      <PageContainer className="space-y-6">
        <PageHeader title="My Profile" description="Loading profile." />
        <PageLoading rows={6} label="Loading your profile..." />
      </PageContainer>
    );
  }

  if (!employeeId) {
    return (
      <PageContainer className="space-y-6">
        <PageHeader title="My Profile" description="No linked employee record." />
        <PageEmpty
          icon={User}
          title="No linked employee profile"
          description="Contact a tenant HR administrator to link your record."
        />
      </PageContainer>
    );
  }

  if (isLoading && !profile && !error) {
    return (
      <PageContainer className="space-y-6">
        <PageHeader title="My Profile" description="Loading profile." />
        <PageLoading rows={6} label="Loading your profile..." />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer className="space-y-6">
        <PageHeader title="My Profile" />
        <PageError
          title="Your profile could not be found"
          description="Your linked employee profile is not available right now."
        />
      </PageContainer>
    );
  }

  if (!profile) {
    return (
      <PageContainer className="space-y-6">
        <PageHeader title="My Profile" description="Profile unavailable." />
        <PageEmpty
          icon={User}
          title="Unable to load profile"
          description="Your employee profile is not available right now."
        />
      </PageContainer>
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
