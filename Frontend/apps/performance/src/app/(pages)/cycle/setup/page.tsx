"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageSkeleton } from "@repo/ds/shell";

/** /cycle/setup has no content of its own — it opens the first step. */
export default function CycleSetupIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/cycle/setup/details");
  }, [router]);
  return <PageSkeleton rows={2} label="Opening setup" />;
}
