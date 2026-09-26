"use client";

import type { OrganizationImportReviewReadiness } from "@repo/api";
import { ImportReviewFooter } from "@/features/data-import/components/review-footer";

/** Organization's Review flow bar: a proposal with nothing new finishes without writing. */
export function ReviewFooter({
  matchHref,
  readiness,
  publishing,
  onPublish,
}: {
  matchHref: string;
  readiness: OrganizationImportReviewReadiness;
  publishing: boolean;
  onPublish: () => void;
}) {
  return (
    <ImportReviewFooter
      matchHref={matchHref}
      blockingCount={readiness.blockingIssueCount}
      canPublish={readiness.canPublish}
      noop={readiness.canPublish && readiness.createCount === 0}
      busy={publishing}
      publishLabel="Publish organization"
      noopLabel={{ idle: "Finish import", busy: "Finishing…", status: "Ready to publish" }}
      onPublish={onPublish}
    />
  );
}
