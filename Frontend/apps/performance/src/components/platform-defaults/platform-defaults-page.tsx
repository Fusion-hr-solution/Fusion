"use client";

import { useMemo } from "react";
import { ApiError, createPlatformApiClient, performancePaths, performanceQueryKeys } from "@repo/api";
import { useApiQuery } from "@repo/api/query";
import type { PlatformDefaultsSummaryDto } from "@repo/api";
import {
  PageContainer,
  PageError,
  PageHeader,
  PageLoading,
  StatusBadge,
} from "@repo/ds/shell";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BaselineEditor } from "./baseline-editor";
import { GuardrailsEditor } from "./guardrails-editor";
import { formatDate } from "@/lib/labels";

export function PlatformDefaultsPage() {
  const apiClient = useMemo(() => createPlatformApiClient(), []);

  const {
    data: summary,
    isLoading,
    error,
    refetch,
  } = useApiQuery<PlatformDefaultsSummaryDto>(
    performanceQueryKeys.platformDefaultsSummary(),
    (signal) =>
      apiClient.get<PlatformDefaultsSummaryDto>(performancePaths.platformDefaultsSummary(), { signal }),
  );

  const isForbidden = error instanceof ApiError && error.status === 403;

  return (
    <PageContainer>
      <PageHeader title="Performance defaults" />

      {isLoading ? <PageLoading rows={6} /> : null}

      {!isLoading && error ? (
        <PageError
          title={isForbidden ? "Platform admin access required" : "Could not load defaults"}
          description={isForbidden ? undefined : "Try again."}
          onRetry={isForbidden ? undefined : () => void refetch()}
        />
      ) : null}

      {!isLoading && !error && summary ? (
        <div className="space-y-5">
          <Card size="sm">
            <CardContent density="compact" className="grid gap-3 py-3 sm:grid-cols-3">
              <StatusItem
                label="Standard setup"
                value={summary.appliedBaseline ? "Applied" : "Missing"}
                status={
                  summary.appliedBaseline ? (
                    <StatusBadge tone="success" dot>
                      Live
                    </StatusBadge>
                  ) : (
                    <StatusBadge tone="neutral" dot>
                      Empty
                    </StatusBadge>
                  )
                }
              />
              <StatusItem
                label="Limits"
                value={summary.appliedGuardrails ? "Applied" : "Missing"}
                status={
                  summary.appliedGuardrails ? (
                    <StatusBadge tone="success" dot>
                      Live
                    </StatusBadge>
                  ) : (
                    <StatusBadge tone="neutral" dot>
                      Empty
                    </StatusBadge>
                  )
                }
              />
              <StatusItem
                label="Last change"
                value={summary.lastUpdated ? formatDate(summary.lastUpdated.occurredAt) : "None"}
                status={
                  <StatusBadge tone={summary.status.tone} dot>
                    {summary.status.label}
                  </StatusBadge>
                }
              />
            </CardContent>
          </Card>

          <Tabs defaultValue="baseline">
            <TabsList>
              <TabsTrigger value="baseline">Standard setup</TabsTrigger>
              <TabsTrigger value="limits">Limits</TabsTrigger>
            </TabsList>
            <TabsContent value="baseline">
              <BaselineEditor
                appliedPolicy={summary.appliedBaseline}
                guardrails={summary.appliedGuardrails}
                onSaved={() => void refetch()}
              />
            </TabsContent>
            <TabsContent value="limits">
              <GuardrailsEditor
                appliedGuardrails={summary.appliedGuardrails}
                onSaved={() => void refetch()}
              />
            </TabsContent>
          </Tabs>
        </div>
      ) : null}
    </PageContainer>
  );
}

function StatusItem({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-foreground">{value}</p>
      </div>
      {status}
    </div>
  );
}
