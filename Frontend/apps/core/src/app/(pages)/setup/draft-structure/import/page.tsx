"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CorePageLoadingState } from "@/components/core-page-loading-state";

export default function DraftStructureImportRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("import", "1");
    router.replace(`/setup/draft-structure?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <CorePageLoadingState
      title="Draft Structure Import"
      description="Redirecting to the draft workspace..."
      message="Opening the draft structure import workspace..."
      variant="redirect"
    />
  );
}
