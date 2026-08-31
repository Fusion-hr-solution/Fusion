"use client";

export const dynamic = "force-dynamic";

import { User } from "lucide-react";
import { useAuth } from "@repo/auth";
import {
  PageContainer,
  PageHeader,
  PageEmpty,
  PageError,
} from "@repo/ds/shell";
import { MyProfilePageSkeleton } from "@/shell/route-skeletons";
import { useTenantSettings } from "@/features/settings/api/use-tenant-settings";
import { MyProfileWorkspace } from "@/features/employees/profile/my-profile-workspace";
import {
  useEmployeeDetailsById,
  useEmployeeReportingLines,
} from "../employees/use-employees";

export default function MyProfilePage() {
  const { user, isLoading: authLoading } = useAuth();
  const employeeId = user?.employeeId ?? null;
  const canViewProfile = !!employeeId;

  const { data: settings } = useTenantSettings(canViewProfile);

  const {
    data: details,
    error,
    isLoading,
  } = useEmployeeDetailsById(canViewProfile ? employeeId : null);

  const { data: reportingLines } = useEmployeeReportingLines(
    details?.stableEmployeeKey ?? null
  );

  if (authLoading) {
    return <MyProfilePageSkeleton />;
  }

  if (!employeeId) {
    return (
      <PageContainer className="space-y-6">
        <PageHeader
          title="My Profile"
          description="No linked employee record."
        />
        <PageEmpty
          icon={User}
          title="No linked employee profile"
          description="Contact a tenant HR administrator to link your record."
        />
      </PageContainer>
    );
  }

  if (isLoading && !details && !error) {
    return <MyProfilePageSkeleton />;
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

  if (!details) {
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
    user?.employeeId === details.id &&
    settings?.selfService.canEditPreferredName !== false;
  const canEditOwnPhone =
    user?.employeeId === details.id &&
    settings?.selfService.canEditPhone !== false;

  return (
    <MyProfileWorkspace
      details={details}
      reportingLines={reportingLines}
      canEditPreferredName={canEditOwnPreferredName}
      canEditPhone={canEditOwnPhone}
    />
  );
}
