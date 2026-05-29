"use client";

import { User } from "lucide-react";
import { useAuth } from "@repo/auth";
import { EmptyState } from "@repo/ui";
import { CorePageLoadingState } from "@/components/core-page-loading-state";
import { PageHeader } from "@/components/page-header";
import EmployeeProfilePage from "../employees/[id]/page";
import { EmployeeProfileRouteProvider } from "../employees/employee-profile-route-context";

export default function MyProfilePage() {
  const { user, isLoading } = useAuth();
  const employeeId = user?.employeeId ?? null;

  if (isLoading) {
    return (
      <CorePageLoadingState
        title="My Profile"
        description="Loading your profile..."
        message="Loading your profile..."
        variant="summary-list"
      />
    );
  }

  if (employeeId) {
    return (
      <EmployeeProfileRouteProvider
        value={{ employeeId, route: "self" }}
      >
        <EmployeeProfilePage />
      </EmployeeProfileRouteProvider>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="My Profile"
        description="Your account is not linked to an employee record."
      />
      <EmptyState
        icon={User}
        title="No linked employee profile"
        description="Contact a tenant HR administrator to link you in the roster."
      />
    </div>
  );
}
