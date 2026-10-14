"use client";

import { PageContainer, PageError, PagePermissionNotice, PageSkeleton } from "@repo/ds/shell";
import { useSettings } from "@/features/performance/api/use-performance";
import { useWorkspaceContext } from "@/features/performance/api/use-workspace";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { PerformancePageHeading } from "@/features/performance/components/performance-page-heading";
import { SettingsForm } from "@/features/performance/components/settings-form";

export default function SettingsPage() {
  const context = useWorkspaceContext();
  const canAdminister = context.data?.capabilities.administers ?? false;
  const settings = useSettings(canAdminister);

  if (context.isLoading) return <PageSkeleton rows={4} label="Loading settings" />;
  if (context.error && !canAdminister) return <PagePermissionNotice title="Administration only" description="Performance settings are available to administrators." />;
  if (context.error) return <ContentUnavailable error={context.error} onRetry={context.refetch} subject="Performance workspace" />;
  if (!canAdminister) {
    return <PagePermissionNotice title="Administration only" description="Performance settings are available to administrators." />;
  }

  return (
    <PageContainer>
      <PerformancePageHeading
        title="Performance settings"
        description="Tenant defaults for new Cycles. Changing them never alters a Cycle that is already active."
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
