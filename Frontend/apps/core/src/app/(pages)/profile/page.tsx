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
        title="My profile"
        description="Opening your employee profile."
        message="Opening profile..."
        variant="summary-list"
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="My profile"
        description="Your employee profile will appear here once it is linked."
      />
      <EmptyState
        icon={User}
        title="Profile not ready yet"
        description="Ask an HR administrator to link your employee record."
        action={{
          label: "Open Core",
          onClick: () => router.push("/"),
        }}
      />
    </div>
  );
}
