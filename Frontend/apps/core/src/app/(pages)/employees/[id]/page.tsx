"use client";

import { useParams } from "next/navigation";
import { Users, User } from "lucide-react";
import {
  canManageCoreAccess,
  canManageCoreEmployees,
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
} from "../use-employees";
import {
  type EmployeeProfileRouteKind,
  useEmployeeProfileRouteContext,
} from "../employee-profile-route-context";

export default function EmployeeProfilePage() {
  const { user } = useAuth();
  const params = useParams<{ id?: string }>();
  const routeContext = useEmployeeProfileRouteContext();
  const { tenantId } = useTenantContext();
  const route: EmployeeProfileRouteKind = routeContext?.route ?? "employee";
  const isSelfRoute = route === "self";
  const isTenantContextReadOnly = !!tenantId;
  const canManageEmployee =
    canManageCoreEmployees(user) && !isTenantContextReadOnly;
  const canManageAccess = canManageCoreAccess(user) && !isTenantContextReadOnly;
  const canViewProfile = canAccessEmployeeProfile(user);
  const employeeId =
    routeContext?.employeeId ??
    (typeof params.id === "string" && params.id.trim().length > 0
      ? params.id
      : null);
  const isOwnProfile = !!employeeId && user?.employeeId === employeeId;
  const isSelfView = isSelfRoute || isOwnProfile;
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

  const effectiveEmployeeId =
    (canViewProfile || isTenantContextReadOnly) && employeeId
      ? employeeId
      : null;

  const {
    data: profile,
    error,
    isLoading,
  } = useEmployeeProfile(effectiveEmployeeId);

  const { data: reportingLines } =
    useEmployeeReportingLines(effectiveEmployeeId);

  // Register employee name in the top breadcrumb (Core > Employees > Jane Smith)
  useBreadcrumbLabel(
    isSelfRoute ? "" : (employeeId ?? ""),
    isSelfRoute ? undefined : profile?.fullName
  );

  const isInitialLoading =
    (canViewProfile || isTenantContextReadOnly) &&
    isLoading &&
    !profile &&
    !error;

  if (isInitialLoading) {
    return (
      <CorePageLoadingState
        title={isSelfRoute ? "My Profile" : "Employee Profile"}
        description={
          isSelfRoute ? "Loading profile." : "Loading employee profile."
        }
        message={
          isSelfRoute
            ? "Loading your profile..."
            : "Loading employee profile..."
        }
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
          title={
            isSelfRoute
              ? "Your profile is not available for this role"
              : "Employee profile is not available for this role"
          }
          description={
            isSelfRoute
              ? "Contact a tenant HR administrator if you expected access."
              : "Contact a tenant HR administrator."
          }
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
                ? isSelfRoute
                  ? "Your profile is outside your current access scope"
                  : "Employee is outside your scope"
                : isSelfRoute
                  ? "Your profile could not be found"
                  : "Employee not found"
            }
            description={
              isForbidden
                ? isSelfRoute
                  ? "Your linked record is outside your current Core access scope."
                  : "This employee is outside your current Core access scope."
                : isSelfRoute
                  ? "Your linked employee profile is not available right now."
                  : "This employee is not available right now."
            }
          />
        ) : (
          <Alert variant="destructive">
            <AlertTitle>Failed to load employee profile</AlertTitle>
            <AlertDescription>
              {error.message || "An unexpected error occurred."}
            </AlertDescription>
          </Alert>
        )}
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
    employeeId: effectiveEmployeeId!,
    isSelfRoute,
    isSelfView,
    isTenantContextReadOnly,
    canManageEmployee,
    canManageAccess,
    canEditOwnPreferredName,
    canEditOwnPhone,
  };

  return <EmployeeProfileWorkspace {...workspaceProps} />;
}
