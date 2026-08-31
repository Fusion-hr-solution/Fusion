"use client";

import { PageContainer, PageError, PagePermissionNotice, PageSkeleton } from "@repo/ds/shell";
import { usePerformanceAccess, useSettings } from "@/features/performance/api/use-performance";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { PerformancePageHeading } from "@/features/performance/components/performance-page-heading";
import { SettingsForm } from "@/features/performance/components/settings-form";

export default function SettingsPage() {
  const access = usePerformanceAccess();
  const canAdminister = access.data?.canAdminister ?? false;
  const settings = useSettings(canAdminister);

  if (access.isLoading) return <PageSkeleton rows={4} label="Loading settings" />;
  if (!canAdminister) {
    return <PagePermissionNotice title="Administration only" description="Performance settings are available to administrators." />;
  }

  return (
    <PageContainer>
      <PerformancePageHeading
        title="Performance settings"
        description="Tenant defaults for new cycles. Changing them never alters a Cycle that is already active."
      />
      {settings.isLoading ? (
        <PageSkeleton rows={4} label="Loading settings" />
      ) : settings.error ? (
        <ContentUnavailable error={settings.error} onRetry={settings.refetch} subject="Settings" />
      ) : !settings.data ? (
        <PageError title="Settings unavailable" description="No settings were returned." onRetry={settings.refetch} />
      ) : (
        <SettingsForm settings={settings.data} />
      )}
    </PageContainer>
  );
}
