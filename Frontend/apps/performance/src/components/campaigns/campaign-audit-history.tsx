"use client";

import { useMemo, useState } from "react";
import { History } from "lucide-react";
import {
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
  type CycleAuditEventDto,
  type PagedResponse,
} from "@repo/api";
import { useApiQuery } from "@repo/api/query";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/labels";

import { campaignAuditTerms } from "./campaign-audit-terms";

const PAGE_SIZE = 10;

/**
 * The campaign's change history.
 *
 * These events have been written since the campaign work landed and read by nobody — this is the
 * read path. Paginated because the trail is append-only: it only ever grows, so an unbounded read
 * would cost more every cycle the campaign lives through.
 */
export function CampaignAuditHistory({ cycleId }: { cycleId: string }) {
  const api = useMemo(() => createPlatformApiClient(), []);
  const [page, setPage] = useState(1);
  const params = { page, pageSize: PAGE_SIZE };

  const { data, isLoading, error, refetch } = useApiQuery<
    PagedResponse<CycleAuditEventDto>
  >(
    performanceQueryKeys.cycleAudit(cycleId, params),
    (signal) =>
      api.get<PagedResponse<CycleAuditEventDto>>(
        performancePaths.cycleAudit(cycleId, params),
        { signal },
      ),
    { enabled: !!cycleId },
  );

  return (
    <section className="rounded-2xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" aria-hidden />
          <h2 className="text-base font-semibold">{campaignAuditTerms.title}</h2>
        </div>
        {data && data.totalCount > 0 ? (
          <span className="text-xs tabular-nums text-muted-foreground">
            {campaignAuditTerms.count(data.totalCount)}
          </span>
        ) : null}
      </header>

      <div className="px-5 py-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{campaignAuditTerms.loading}</p>
        ) : error ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">{campaignAuditTerms.failed}</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              {campaignAuditTerms.retry}
            </Button>
          </div>
        ) : !data?.items?.length ? (
          <p className="text-sm text-muted-foreground">{campaignAuditTerms.empty}</p>
        ) : (
          <>
            <ol className="flex flex-col gap-3">
              {data.items.map((event) => (
                <li key={event.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="min-w-40 text-xs tabular-nums text-muted-foreground">
                    {formatDateTime(event.occurredAt)}
                  </span>
                  <span className="font-medium text-foreground">
                    {campaignAuditTerms.action(event.action)}
                  </span>
                  {event.actorName ? (
                    <span className="text-sm text-muted-foreground">
                      {campaignAuditTerms.by(event.actorName)}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {campaignAuditTerms.bySystem}
                    </span>
                  )}
                  {event.details ? (
                    <span className="w-full text-sm text-muted-foreground">
                      {event.details}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>

            {(data.totalPages ?? 1) > 1 ? (
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
                <span className="text-xs tabular-nums text-muted-foreground">
                  {campaignAuditTerms.pageOf(data.page, data.totalPages)}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!data.hasPreviousPage}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    {campaignAuditTerms.newer}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!data.hasNextPage}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    {campaignAuditTerms.older}
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
