"use client";

import { PageError } from "@repo/ds/shell";
import { classifyApiError } from "@repo/api";

/**
 * Attributed, frame-preserving failure state for a Performance content region.
 * It distinguishes a temporarily-unavailable upstream (retry will recover once the
 * backend is back — no full-page reload) from an unexpected application error, so
 * the user sees the real cause. It always renders inside the persistent module
 * frame; the retry re-runs the query and recovers cleanly on restore.
 */
export function ContentUnavailable({
  error,
  onRetry,
  subject,
}: {
  error: Error;
  onRetry: () => void;
  /** What could not load, e.g. "Cycle" or "Settings". */
  subject: string;
}) {
  const kind = classifyApiError(error);

  if (kind === "upstream-unavailable" || kind === "network") {
    return (
      <PageError
        title="Temporarily unavailable"
        description={`${subject} could not be loaded because the service is temporarily unavailable. It will recover when the service is back.`}
        onRetry={onRetry}
        retryLabel="Retry"
      />
    );
  }

  return (
    <PageError
      title={`${subject} unavailable`}
      description={error.message}
      onRetry={onRetry}
    />
  );
}
