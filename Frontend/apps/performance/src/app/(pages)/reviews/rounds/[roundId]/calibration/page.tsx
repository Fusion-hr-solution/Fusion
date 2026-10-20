"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { CalibrationWorkspacePage } from "@/features/performance/components/calibration/calibration-workspace";

export default function CalibrationPage() {
  const params = useParams<{ roundId: string }>();
  return (
    <Suspense>
      <CalibrationWorkspacePage roundId={params.roundId} />
    </Suspense>
  );
}
