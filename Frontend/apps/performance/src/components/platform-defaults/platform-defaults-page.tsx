"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  ApiError,
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
} from "@repo/api";
import type {
  ApplyPlatformPerformanceConfigurationRequest,
  PlatformConfigurationImpactDto,
  PlatformConfigurationApplyResultDto,
  PlatformPerformanceConfigurationDto,
  PlatformPerformanceConfigurationSummaryDto,
} from "@repo/api";
import { useApiMutation, useApiQuery } from "@repo/api/query";
import {
  PageContainer,
  PageError,
  PageHeader,
  PageLoading,
  PagePermissionNotice,
} from "@repo/ds/shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  ConfigurationApplyPanel,
  ConfigurationCard,
  CountSlider,
  MeasurementChoices,
  WeightChoices,
} from "@/components/performance-configuration/configuration-controls";
import {
  PROFESSIONAL_WEIGHT_MENU,
  mergeWeightChoices,
  parseWeights,
  serializeWeights,
  validatePlatformForm,
  type PlatformConfigurationForm,
} from "@/components/performance-configuration/configuration-logic";

export function PlatformDefaultsPage() {
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const [form, setForm] = useState<PlatformConfigurationForm>(() => defaultForm(null));
  const [applyBlock, setApplyBlock] = useState<{
    errors: string[];
    impact: PlatformConfigurationImpactDto | null;
  } | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const {
    data: summary,
    isLoading,
    error,
    refetch,
  } = useApiQuery<PlatformPerformanceConfigurationSummaryDto>(
    performanceQueryKeys.platformPerformanceConfiguration(),
    (signal) =>
      apiClient.get<PlatformPerformanceConfigurationSummaryDto>(
        performancePaths.platformPerformanceConfiguration(),
        { signal },
      ),
  );

  useEffect(() => {
    setForm(defaultForm(summary?.configuration ?? null));
    setApplyBlock(null);
    setApplyError(null);
  }, [summary?.configuration]);

  const apply = useApiMutation<
    PlatformConfigurationApplyResultDto,
    ApplyPlatformPerformanceConfigurationRequest
  >(
    (request) =>
      apiClient.post<PlatformConfigurationApplyResultDto>(
        performancePaths.platformPerformanceConfigurationApply(),
        request,
        summary?.configuration
          ? { headers: { "If-Match": `"${summary.configuration.version}"` } }
          : undefined,
      ),
    {
      onSuccess: async (result) => {
        if (!result.applied) {
          setApplyBlock({ errors: result.errors, impact: result.impact });
          return;
        }

        toast.success("Platform performance configuration applied");
        setApplyBlock(null);
        setApplyError(null);
        await refetch();
      },
      onError: (err) => {
        setApplyBlock(null);
        setApplyError(
          err instanceof ApiError && err.status === 409
            ? "This configuration changed. Your edits are still here; review the latest values before applying again."
            : err.message,
        );
      },
    },
  );

  const isForbidden = error instanceof ApiError && error.status === 403;
  const request = toRequest(form);
  const localErrors = validatePlatformForm(form);
  const savedForm = defaultForm(summary?.configuration ?? null);
  const isDirty = !summary?.isConfigured || serializePlatformForm(form) !== serializePlatformForm(savedForm);
  const canApply = isDirty && localErrors.length === 0 && !apply.isLoading;

  return (
    <PageContainer width="narrow">
      <PageHeader
        title="Platform performance configuration"
        description="System-supported planning limits and the starting configuration copied to new tenants."
      />

      {isLoading ? <PageLoading rows={6} label="Loading platform configuration" /> : null}

      {!isLoading && error ? (
        isForbidden ? (
          <PagePermissionNotice title="Platform admin access required" />
        ) : (
          <PageError title="Could not load configuration" description="Try again." onRetry={refetch} />
        )
      ) : null}

      {!isLoading && !error ? (
        <div className="space-y-4">
          {!summary?.isConfigured ? (
            <Alert>
              <AlertTriangle />
              <AlertTitle>Not configured</AlertTitle>
              <AlertDescription>
                No platform configuration is applied yet. The values below are editable starting values, not saved platform truth.
              </AlertDescription>
            </Alert>
          ) : null}

          <ConfigurationCard title="System limits">
            <CountSlider
              label="Maximum objective count"
              value={form.maxObjectiveCountLimit}
              min={1}
              max={20}
              disabled={false}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  maxObjectiveCountLimit: value,
                  startingMaxObjectiveCount: Math.min(prev.startingMaxObjectiveCount, value),
                }))
              }
            />
            <WeightChoices
              label="Supported objective weights"
              description="Weights are business importance choices for future objective plans."
              choices={mergeWeightChoices(PROFESSIONAL_WEIGHT_MENU, form.supportedWeights)}
              value={form.supportedWeights}
              disabled={false}
              onChange={(weights) =>
                setForm((prev) => ({
                  ...prev,
                  supportedWeights: weights,
                  startingWeights: prev.startingWeights.filter((weight) => weights.includes(weight)),
                }))
              }
            />
            <MeasurementChoices
              quantitativeLabel="Quantitative available"
              qualitativeLabel="Qualitative available"
              quantitative={form.quantitativeAvailable}
              qualitative={form.qualitativeAvailable}
              disabled={false}
              onChange={(quantitative, qualitative) =>
                setForm((prev) => ({
                  ...prev,
                  quantitativeAvailable: quantitative,
                  qualitativeAvailable: qualitative,
                  startingQuantitativeEnabled: prev.startingQuantitativeEnabled && quantitative,
                  startingQualitativeEnabled: prev.startingQualitativeEnabled && qualitative,
                }))
              }
            />
          </ConfigurationCard>

          <ConfigurationCard title="Starting tenant configuration">
            <CountSlider
              label="Starting maximum objective count"
              value={form.startingMaxObjectiveCount}
              min={1}
              max={form.maxObjectiveCountLimit}
              disabled={false}
              onChange={(value) => setForm((prev) => ({ ...prev, startingMaxObjectiveCount: value }))}
            />
            <WeightChoices
              label="Starting allowed weights"
              description="This starter menu is copied only when a new tenant is provisioned."
              choices={form.supportedWeights}
              value={form.startingWeights}
              disabled={false}
              onChange={(weights) => setForm((prev) => ({ ...prev, startingWeights: weights }))}
            />
            <MeasurementChoices
              quantitativeLabel="Quantitative enabled"
              qualitativeLabel="Qualitative enabled"
              quantitative={form.startingQuantitativeEnabled}
              qualitative={form.startingQualitativeEnabled}
              disabled={false}
              quantitativeDisabled={!form.quantitativeAvailable}
              qualitativeDisabled={!form.qualitativeAvailable}
              onChange={(quantitative, qualitative) =>
                setForm((prev) => ({
                  ...prev,
                  startingQuantitativeEnabled: quantitative,
                  startingQualitativeEnabled: qualitative,
                }))
              }
            />
          </ConfigurationCard>

          <ConfigurationApplyPanel
            localErrors={localErrors}
            serverErrors={applyBlock?.errors}
            impact={applyBlock?.impact}
            applyError={applyError}
            isApplying={apply.isLoading}
            isDirty={isDirty}
            canApply={canApply}
            onApply={() => apply.mutate(request)}
            dirtyHint="Apply will validate impact and save atomically."
          />
        </div>
      ) : null}
    </PageContainer>
  );
}

function defaultForm(configuration: PlatformPerformanceConfigurationDto | null): PlatformConfigurationForm {
  if (!configuration) {
    return {
      maxObjectiveCountLimit: 10,
      supportedWeights: PROFESSIONAL_WEIGHT_MENU,
      quantitativeAvailable: true,
      qualitativeAvailable: true,
      startingMaxObjectiveCount: 5,
      startingWeights: PROFESSIONAL_WEIGHT_MENU,
      startingQuantitativeEnabled: true,
      startingQualitativeEnabled: true,
    };
  }

  return {
    maxObjectiveCountLimit: configuration.maxObjectiveCountLimit,
    supportedWeights: parseWeights(configuration.supportedAllowedWeights),
    quantitativeAvailable: configuration.quantitativeAvailable,
    qualitativeAvailable: configuration.qualitativeAvailable,
    startingMaxObjectiveCount: configuration.startingConfiguration.maxObjectiveCount,
    startingWeights: parseWeights(configuration.startingConfiguration.allowedWeights),
    startingQuantitativeEnabled: configuration.startingConfiguration.quantitativeEnabled,
    startingQualitativeEnabled: configuration.startingConfiguration.qualitativeEnabled,
  };
}

function toRequest(form: PlatformConfigurationForm): ApplyPlatformPerformanceConfigurationRequest {
  return {
    maxObjectiveCountLimit: form.maxObjectiveCountLimit,
    supportedAllowedWeights: serializeWeights(form.supportedWeights),
    quantitativeAvailable: form.quantitativeAvailable,
    qualitativeAvailable: form.qualitativeAvailable,
    startingMaxObjectiveCount: form.startingMaxObjectiveCount,
    startingAllowedWeights: serializeWeights(form.startingWeights),
    startingQuantitativeEnabled: form.startingQuantitativeEnabled,
    startingQualitativeEnabled: form.startingQualitativeEnabled,
  };
}

function serializePlatformForm(form: PlatformConfigurationForm): string {
  return JSON.stringify({
    maxObjectiveCountLimit: form.maxObjectiveCountLimit,
    supportedWeights: serializeWeights(form.supportedWeights),
    quantitativeAvailable: form.quantitativeAvailable,
    qualitativeAvailable: form.qualitativeAvailable,
    startingMaxObjectiveCount: form.startingMaxObjectiveCount,
    startingWeights: serializeWeights(form.startingWeights),
    startingQuantitativeEnabled: form.startingQuantitativeEnabled,
    startingQualitativeEnabled: form.startingQualitativeEnabled,
  });
}
