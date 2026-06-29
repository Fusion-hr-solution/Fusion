"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageContainer, PageHeader, PageLoading } from "@repo/ds/shell";

export default function DraftStructureImportRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("import", "1");
    router.replace(`/setup/draft-structure?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <PageContainer width="wide" className="space-y-6">
      <PageHeader
        title="Draft Structure Import"
        description="Redirecting to the draft workspace..."
      />
      <PageLoading rows={4} label="Opening the draft structure import workspace..." />
    </PageContainer>
  );
}
