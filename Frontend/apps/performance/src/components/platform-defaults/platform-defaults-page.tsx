"use client";

import { useMemo } from "react";
import { ShieldCheck, Settings2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ApiError, createPlatformApiClient } from "@repo/api";
import { useApiQuery } from "@repo/api/query";
import { performancePaths, performanceQueryKeys } from "@repo/api";
import type { GuardrailsDto, BaselineVersionDto } from "@repo/api";
import {
  PageContainer,
  PageError,
  PageHeader,
  PageLoading,
  StatusBadge,
} from "@repo/ds/shell";
import { GuardrailsEditor } from "./guardrails-editor";
import { BaselineEditor } from "./baseline-editor";

export function PlatformDefaultsPage() {
  const apiClient = useMemo(() => createPlatformApiClient(), []);

  const {
    data: guardrails,
    isLoading: guardrailsLoading,
    error: guardrailsError,
    refetch: refetchGuardrails,
  } = useApiQuery<GuardrailsDto>(
    performanceQueryKeys.platformGuardrails(),
    (signal) => apiClient.get<GuardrailsDto>(performancePaths.platformGuardrails(), { signal }),
  );

  const {
    data: baselineVersions,
    isLoading: baselineLoading,
    error: baselineError,
    refetch: refetchBaseline,
  } = useApiQuery<BaselineVersionDto[]>(
    performanceQueryKeys.platformBaseline(),
    (signal) => apiClient.get<BaselineVersionDto[]>(performancePaths.platformBaseline(), { signal }),
  );

  const guardrailsNotConfigured = guardrailsError instanceof ApiError && guardrailsError.status === 404;
  const baselineNotConfigured = baselineError instanceof ApiError && baselineError.status === 404;
  const resolvedGuardrails = guardrailsNotConfigured ? null : (guardrails ?? null);
  const resolvedBaselineVersions = baselineNotConfigured ? [] : (baselineVersions ?? []);

  const draftBaseline = resolvedBaselineVersions.find((v) => v.status === "Draft");
  const publishedBaseline = resolvedBaselineVersions.find((v) => v.status === "Published");

  return (
    <PageContainer>
      <PageHeader
        title="Platform defaults"
        description="These settings define the starting configuration for newly provisioned tenants. Existing tenants are not changed automatically."
      />

      {/* Guardrails section */}
      <section aria-labelledby="guardrails-heading" className="space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h2 id="guardrails-heading" className="text-base font-medium">Performance guardrails</h2>
          {guardrails && (
            <StatusBadge tone={guardrails.isDraft ? "warning" : "success"} dot>
              {guardrails.isDraft ? "Unpublished changes" : "Published"}
            </StatusBadge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          System-wide limits that tenant policies cannot exceed.
        </p>

        {guardrailsLoading && <PageLoading rows={3} />}

        {guardrailsError && !guardrailsNotConfigured && (
          <PageError
            title="Could not load guardrails"
            description="There was a problem fetching the current guardrails."
            onRetry={() => void refetchGuardrails()}
          />
        )}

        {!guardrailsLoading && (!guardrailsError || guardrailsNotConfigured) && (
          <GuardrailsEditor guardrails={resolvedGuardrails} onSaved={() => void refetchGuardrails()} />
        )}
      </section>

      <Separator />

      {/* Baseline section */}
      <section aria-labelledby="baseline-heading" className="space-y-4">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h2 id="baseline-heading" className="text-base font-medium">Default policy for new tenants</h2>
          {draftBaseline && (
            <StatusBadge tone="warning" dot>Unpublished changes v{draftBaseline.versionNumber}</StatusBadge>
          )}
          {publishedBaseline && (
            <StatusBadge tone="success" dot>Published v{publishedBaseline.versionNumber}</StatusBadge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          When a new tenant is provisioned, the published baseline becomes their initial objective policy.
          Publishing a new baseline does not affect tenants that are already active.
        </p>

        {baselineLoading && <PageLoading rows={2} />}

        {baselineError && !baselineNotConfigured && (
          <PageError
            title="Could not load baseline"
            description="There was a problem fetching baseline versions."
            onRetry={() => void refetchBaseline()}
            retryLabel="Retry"
          />
        )}

        {!baselineLoading && (!baselineError || baselineNotConfigured) && (
          <BaselineEditor versions={resolvedBaselineVersions} onSaved={() => void refetchBaseline()} />
        )}
      </section>
    </PageContainer>
  );
}
