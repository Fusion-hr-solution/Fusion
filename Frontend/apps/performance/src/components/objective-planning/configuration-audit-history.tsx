"use client";

import { useMemo, useState } from "react";
import { History } from "lucide-react";
import {
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
  type ConfigurationAuditEntryDto,
  type PagedResponse,
} from "@repo/api";
import { useApiQuery } from "@repo/api/query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/labels";

import { configurationAuditTerms } from "./configuration-audit-terms";

const PAGE_SIZE = 10;

/**
 * The configuration change history.
 *
 * Written since the configuration work landed and, until now, readable by nobody. The server
 * decides scope: tenant administrators see their tenant's entries, platform entries only reach a
 * platform administrator — so this renders whatever it is given without a client-side filter that
 * could disagree with the server.
 */
export function ConfigurationAuditHistory() {
  const api = useMemo(() => createPlatformApiClient(), []);
  const [page, setPage] = useState(1);
  const params = { page, pageSize: PAGE_SIZE };

  const { data, isLoading, error, refetch } = useApiQuery<
    PagedResponse<ConfigurationAuditEntryDto>
  >(
    performanceQueryKeys.objectivePlanningConfigurationAudit(params),
    (signal) =>
      api.get<PagedResponse<ConfigurationAuditEntryDto>>(
        performancePaths.objectivePlanningConfigurationAudit(params),
        { signal },
      ),
  );

  return (
    <section className="rounded-2xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" aria-hidden />
          <h2 className="text-base font-semibold">
            {configurationAuditTerms.title}
          </h2>
        </div>
        {data && data.totalCount > 0 ? (
          <span className="text-xs tabular-nums text-muted-foreground">
            {configurationAuditTerms.count(data.totalCount)}
          </span>
        ) : null}
      </header>

      <div className="px-5 py-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">
            {configurationAuditTerms.loading}
          </p>
        ) : error ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {configurationAuditTerms.failed}
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              {configurationAuditTerms.retry}
            </Button>
          </div>
        ) : !data?.items?.length ? (
          <p className="text-sm text-muted-foreground">
            {configurationAuditTerms.empty}
          </p>
        ) : (
          <>
            <ol className="flex flex-col gap-3">
              {data.items.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
                >
                  <span className="min-w-40 text-xs tabular-nums text-muted-foreground">
                    {formatDateTime(entry.occurredAt)}
                  </span>
                  <span className="font-medium text-foreground">
                    {configurationAuditTerms.action(entry.action)}
                  </span>
                  {entry.scope === "Platform" ? (
                    // Platform-wide changes affect every tenant, so they are marked as such
                    // rather than reading like something this tenant did.
                    <Badge variant="outline" className="text-[11px]">
                      {configurationAuditTerms.platformScope}
                    </Badge>
                  ) : null}
                  <span className="text-sm text-muted-foreground">
                    {entry.actorName
                      ? configurationAuditTerms.by(entry.actorName)
                      : configurationAuditTerms.bySystem}
                  </span>
                  {entry.reason ? (
                    <span className="w-full text-sm text-muted-foreground">
                      {entry.reason}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>

            {(data.totalPages ?? 1) > 1 ? (
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
                <span className="text-xs tabular-nums text-muted-foreground">
                  {configurationAuditTerms.pageOf(data.page, data.totalPages)}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!data.hasPreviousPage}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    {configurationAuditTerms.newer}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!data.hasNextPage}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    {configurationAuditTerms.older}
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
