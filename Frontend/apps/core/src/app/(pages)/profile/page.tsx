"use client";

import { useEffect } from "react";
import { User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@repo/auth";
import { EmptyState } from "@repo/ui";
import { CorePageLoadingState } from "@/components/core-page-loading-state";
import { PageHeader } from "@/components/page-header";
import { canAccessSelfEmployeeProfile } from "@/lib/employee-roster-access";

export default function MyProfilePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const canAccess = canAccessSelfEmployeeProfile(user);

  useEffect(() => {
    if (!isLoading && canAccess && user?.employeeId) {
      router.replace(`/employees/${user.employeeId}`);
    }
  }, [canAccess, isLoading, router, user?.employeeId]);

  if (isLoading) {
    return (
      <CorePageLoadingState
        title="My Profile"
        description="Loading your employee workspace..."
        message="Loading profile..."
        variant="summary-list"
      />
    );
  }

  if (!canAccess || !user?.employeeId) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          title="My Profile"
          description="Your linked employee workspace appears here when your account is connected."
        />
        <EmptyState
          icon={User}
          title="Employee profile is not linked yet"
          description="Ask a tenant HR administrator to connect your platform account to an employee record."
        />
      </div>
    );
  }

  return (
    <CorePageLoadingState
      title="My Profile"
      description="Opening your employee workspace..."
      message="Opening profile..."
      variant="redirect"
    />
  );
}
