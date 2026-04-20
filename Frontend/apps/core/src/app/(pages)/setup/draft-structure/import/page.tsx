"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/page-header";

export default function DraftStructureImportRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("import", "1");
    router.replace(`/setup/draft-structure?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Draft Structure Import"
        description="Redirecting to the draft workspace..."
      />
    </div>
  );
}