"use client";

import { PlatformPageState } from "@/features/states/platform-page-state";

export default function PlatformError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PlatformPageState kind="error" onRetry={reset} />;
}
