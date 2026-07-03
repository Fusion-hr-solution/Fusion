"use client";

import type { ApiClient } from "@repo/api";
import { useApiQuery } from "@repo/api/query";
import { performancePaths, performanceQueryKeys } from "@repo/api";
import type { PolicyVersionDto } from "@repo/api";
import { PageEmpty, PageLoading, StatusBadge } from "@repo/ds/shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PolicyVersionDetail } from "./policy-version-detail";
import {
  policyStatusLabel,
  policyStatusTone,
  formatDate,
} from "@/lib/labels";

interface PolicyHistoryProps {
  apiClient: ApiClient;
  onBack: () => void;
}

export function PolicyHistory({ apiClient, onBack }: PolicyHistoryProps) {
  const { data: versions, isLoading } = useApiQuery<PolicyVersionDto[]>(
    performanceQueryKeys.policyHistory(),
    (signal) =>
      apiClient.get<PolicyVersionDto[]>(performancePaths.policyHistory(), { signal }),
  );

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Back to policy
        </Button>
      </div>

      {isLoading && <PageLoading rows={3} />}

      {versions?.length === 0 && (
        <PageEmpty title="No history yet" description="Policy versions will appear here after Apply." />
      )}

      {versions?.map((v) => (
        <Card key={v.id}>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between gap-2 mb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <StatusBadge tone={policyStatusTone(v.status)} dot>
                    {policyStatusLabel(v.status)}
                  </StatusBadge>
                  <span className="text-xs text-muted-foreground">v{v.versionNumber}</span>
                </div>
                {v.activatedAt && v.activatedByName && v.activatedByName !== "Migration" && (
                  <p className="text-xs text-muted-foreground">
                    {formatDate(v.activatedAt)} &middot; {v.activatedByName}
                    {v.changeSummary ? ` &mdash; ${v.changeSummary}` : ""}
                  </p>
                )}
              </div>
            </div>
            <PolicyVersionDetail version={v} compact />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
