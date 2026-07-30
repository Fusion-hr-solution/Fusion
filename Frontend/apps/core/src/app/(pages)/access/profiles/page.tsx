"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageContainer, PageHeader, PageLoading } from "@repo/ds/shell";

export const dynamic = "force-dynamic";

export default function AccessProfilesPage() {
  const router = useRouter();
  const settingsHref = "/settings?tab=access-permissions";

  useEffect(() => {
    router.replace(settingsHref);
  }, [router, settingsHref]);

  return (
    <PageContainer width="wide" className="space-y-6">
      <PageHeader title="Access profiles" description="Redirecting to Settings." />
      <PageLoading rows={4} label="Opening access profile settings" />
    </PageContainer>
  );
}
