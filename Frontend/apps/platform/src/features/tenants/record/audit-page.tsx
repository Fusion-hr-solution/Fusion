"use client";

import { useState } from "react";
import { RefreshCw, ScrollText } from "lucide-react";
import { Button } from "@repo/ds/components/ui/button";
import { AsyncButton } from "@repo/ds/shell";
import { RecordEmpty, RecordSurface } from "./record-ui";
import { useTenantRecord } from "./record-shell";
import { NO_EVENTS } from "./support-access";
import { EventTimeline } from "./tenant-events";

/** Keep the first visit scannable without hiding the complete record. */
const AUDIT_PREVIEW_LIMIT = 10;

/**
 * Everything recorded about this tenant, in the order it happened.
 *
 * Today that is the provisioning, delivery, recovery and activation history
 * this feature owns. Later capabilities add their own categories to the same
 * workspace rather than to a new one — which is why the shape here is a
 * complete destination: it opens with a bounded slice for scanning, while the
 * control below keeps the rest of the recorded history available in place.
 *
 * There are no filters. Filtering across one category would be a control that
 * cannot narrow anything, and a category list padded with entries that produce
 * no events would misrepresent what the record contains.
 */
export function TenantAuditDestination() {
  const { tenant, refresh, isRefreshing } = useTenantRecord();
  const entries = tenant.history;
  const [showAll, setShowAll] = useState(false);
  const hasMore = entries.length > AUDIT_PREVIEW_LIMIT;
  const visibleEntries = showAll ? entries : entries.slice(0, AUDIT_PREVIEW_LIMIT);

  return (
    <RecordSurface
      id="audit-title"
      title="Tenant history"
      description={
        entries.length > 0
          ? `${entries.length} recorded ${entries.length === 1 ? "event" : "events"}`
          : "Provisioning, delivery, recovery and activation."
      }
      icon={ScrollText}
      action={<RefreshButton onRefresh={refresh} isRefreshing={isRefreshing} />}
      bodyClassName={entries.length === 0 ? "pt-0" : undefined}
    >
      {entries.length === 0 ? (
        <RecordEmpty
          icon={ScrollText}
          {...NO_EVENTS}
        />
      ) : (
        <>
          <EventTimeline id="audit-timeline" entries={visibleEntries} />
          {hasMore ? (
            <div className="mt-5 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-expanded={showAll}
                aria-controls="audit-timeline"
                onClick={() => setShowAll((current) => !current)}
              >
                {showAll
                  ? "Show less"
                  : `View more (${entries.length - AUDIT_PREVIEW_LIMIT})`}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </RecordSurface>
  );
}

function RefreshButton({
  onRefresh,
  isRefreshing,
}: {
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  return (
    <AsyncButton
      type="button"
      variant="outline"
      size="sm"
      onClick={onRefresh}
      pending={isRefreshing}
      pendingLabel="Refresh history"
    >
      <RefreshCw aria-hidden="true" className="size-4" />
      Refresh
    </AsyncButton>
  );
}
