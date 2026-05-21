"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { User } from "lucide-react";
import { useAuth } from "@repo/auth";
import { EmptyState } from "@repo/ui";
import { CorePageLoadingState } from "@/components/core-page-loading-state";
import { PageHeader } from "@/components/page-header";

export default function MyProfilePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const employeeId = user?.employeeId ?? null;

  useEffect(() => {
    if (!isLoading && employeeId) {
      router.replace(`/employees/${employeeId}`);
    }
  }, [employeeId, isLoading, router]);

  if (isLoading || employeeId) {
    return (
      <CorePageLoadingState
        title="My Profile"
        description="Loading your profile..."
        message="Loading profile..."
        variant="summary-list"
      />
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
