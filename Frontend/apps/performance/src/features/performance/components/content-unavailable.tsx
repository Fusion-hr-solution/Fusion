"use client";

import { PageError } from "@repo/ds/shell";
import { classifyApiError } from "@repo/api";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("common.ContentUnavailable");
  const kind = classifyApiError(error);

  if (kind === "upstream-unavailable" || kind === "network") {
    return (
      <PageError
        title={t("temporarilyUnavailable")}
        description={t("couldNotBeLoadedBecause", { subject })}
        onRetry={onRetry}
        retryLabel={t("retry")}
      />
    );
  }

  return (
    <PageError
      title={t("unavailable", { subject })}
      description={error.message}
      onRetry={onRetry}
    />
  );
}
