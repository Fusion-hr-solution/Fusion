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
  ApplyObjectivePlanningConfigurationRequest,
  ObjectivePlanningConfigurationApplyResultDto,
  ObjectivePlanningConfigurationDto,
  ObjectivePlanningConfigurationSummaryDto,
} from "@repo/api";
import { useApiMutation, useApiQuery } from "@repo/api/query";
import {
  canManageObjectivePlanningConfiguration,
  canViewObjectivePlanningConfiguration,
  useAuth,
} from "@repo/auth";
import {
  PageContainer,
  PageError,
  PageHeader,
  PagePermissionNotice,
} from "@repo/ds/shell";
import { Skeleton } from "@repo/ds";
import { ConfigurationAuditHistory } from "./configuration-audit-history";
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
  parseWeights,
  serializeWeights,
  validatePlanningForm,
  type ObjectivePlanningForm,
} from "@/components/performance-configuration/configuration-logic";

export function ObjectivePlanningConfigurationPage() {
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const { user, isLoading: authLoading } = useAuth();
  const canView = canViewObjectivePlanningConfiguration(user);
  const canManage = canManageObjectivePlanningConfiguration(user);
  const [form, setForm] = useState<ObjectivePlanningForm | null>(null);
  const [applyBlock, setApplyBlock] = useState<string[] | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const {
    data: summary,
    isLoading,
    error,
    refetch,
  } = useApiQuery<ObjectivePlanningConfigurationSummaryDto>(
    performanceQueryKeys.objectivePlanningConfiguration(),
    (signal) =>
      apiClient.get<ObjectivePlanningConfigurationSummaryDto>(
        performancePaths.objectivePlanningConfiguration(),
        { signal },
      ),
    { enabled: canView },
  );

  useEffect(() => {
    setForm(summary?.configuration ? fromConfiguration(summary.configuration) : null);
    setApplyBlock(null);
    setApplyError(null);
  }, [summary?.configuration]);

  const apply = useApiMutation<
    ObjectivePlanningConfigurationApplyResultDto,
    ApplyObjectivePlanningConfigurationRequest
  >(
    (request) =>
      apiClient.post<ObjectivePlanningConfigurationApplyResultDto>(
        performancePaths.objectivePlanningConfigurationApply(),
        request,
        summary?.configuration
          ? { headers: { "If-Match": `"${summary.configuration.version}"` } }
          : undefined,
      ),
    {
      onSuccess: async (result) => {
        if (!result.applied) {
          setApplyBlock(result.errors);
          return;
        }

        toast.success("Objective planning configuration applied");
        setApplyBlock(null);
        setApplyError(null);
        await refetch();
      },
      onError: (err) => {
        setApplyBlock(null);
        setApplyError(
          err instanceof ApiError && err.status === 409
            ? "This configuration changed. Your edits are still here; reload the latest values before applying."
            : err.message,
        );
      },
    },
  );

  const isForbidden = error instanceof ApiError && error.status === 403;
  const options = summary?.options ?? null;
  const platformWeights = options ? parseWeights(options.supportedAllowedWeights) : [];
  const localErrors = form && options ? validatePlanningForm(form, options.maxObjectiveCountLimit) : [];
  const request = form ? toRequest(form) : null;
  const savedForm = summary?.configuration ? fromConfiguration(summary.configuration) : null;
  const isDirty = !!form && !!savedForm && serializePlanningForm(form) !== serializePlanningForm(savedForm);
  const canApply = canManage && isDirty && localErrors.length === 0 && !apply.isLoading;

  if (authLoading) {
    return (
      <PageContainer width="narrow">
        <PlanningConfigurationSkeleton />
      </PageContainer>
    );
  }

  if (!canView) {
    return (
      <PageContainer width="narrow">
        <PageHeader title="Objective planning" />
        <PagePermissionNotice title="Tenant admin access required" />
      </PageContainer>
    );
  }

  return (
    <PageContainer width="narrow">
      <PageHeader title="Objective planning" />

      {isLoading ? <PlanningConfigurationSkeleton /> : null}

      {!isLoading && error ? (
        isForbidden ? (
          <PagePermissionNotice title="Tenant admin access required" />
        ) : (
          <PageError title="Could not load configuration" description="Try again." onRetry={refetch} />
        )
      ) : null}

      {!isLoading && !error && summary ? (
        <div className="space-y-4">
          {!summary.isConfigured ? (
            <PageError
              title="No objective planning configuration"
              description="This tenant has not been initialized from the platform starting configuration."
              onRetry={refetch}
              retryLabel="Check again"
            />
          ) : !options ? (
            <PageError
              title="Platform configuration unavailable"
              description="Tenant values cannot be edited until platform limits exist."
              onRetry={refetch}
            />
          ) : form ? (
            <>
              {!canManage ? (
                <Alert>
                  <AlertTriangle />
                  <AlertTitle>Read only</AlertTitle>
                  <AlertDescription>
                    You can view the current configuration but cannot apply changes.
                  </AlertDescription>
                </Alert>
              ) : null}

              <ConfigurationCard title="Planning rules">
                <CountSlider
                  label="Maximum objective count"
                  value={form.maxObjectiveCount}
                  min={1}
                  max={options.maxObjectiveCountLimit}
                  disabled={!canManage}
                  onChange={(value) => setForm((prev) => prev && { ...prev, maxObjectiveCount: value })}
                />
                <WeightChoices
                  label="Allowed weight menu"
                  description="Employees and managers will choose from this menu when assigning objective importance in future plans."
                  choices={platformWeights}
                  value={form.allowedWeights}
                  disabled={!canManage}
                  onChange={(weights) => setForm((prev) => prev && { ...prev, allowedWeights: weights })}
                />
                <MeasurementChoices
                  quantitative={form.quantitativeEnabled}
                  qualitative={form.qualitativeEnabled}
                  quantitativeDisabled={!options.quantitativeAvailable}
                  qualitativeDisabled={!options.qualitativeAvailable}
                  disabled={!canManage}
                  onChange={(quantitative, qualitative) =>
                    setForm((prev) => prev && { ...prev, quantitativeEnabled: quantitative, qualitativeEnabled: qualitative })
                  }
                />
              </ConfigurationCard>

              {canManage && request ? (
                <ConfigurationApplyPanel
                  localErrors={localErrors}
                  serverErrors={applyBlock ?? []}
                  applyError={applyError}
                  isApplying={apply.isLoading}
                  isDirty={isDirty}
                  canApply={canApply}
                  onApply={() => apply.mutate(request)}
                  dirtyHint="Apply will validate and save these changes."
                />
              ) : null}
            </>
          ) : null}

          {/* The tenant's configuration trail — written since configuration landed, read by nobody
              until now. */}
          <ConfigurationAuditHistory />
        </div>
      ) : null}
    </PageContainer>
  );
}

function PlanningConfigurationSkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-label="Loading objective planning configuration">
      <div className="space-y-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-6">
        <Skeleton className="h-5 w-32" />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-7 w-10 rounded-md" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-3" />
            <Skeleton className="h-3 w-6" />
          </div>
        </div>

        <div className="space-y-2">
          <Skeleton className="h-4 w-44" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-14 rounded-md" />
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-9 rounded-full" />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-9 rounded-full" />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-8 w-32 rounded-md" />
        </div>
      </div>
    </div>
  );
}

function fromConfiguration(configuration: ObjectivePlanningConfigurationDto): ObjectivePlanningForm {
  return {
    maxObjectiveCount: configuration.maxObjectiveCount,
    allowedWeights: parseWeights(configuration.allowedWeights),
    quantitativeEnabled: configuration.quantitativeEnabled,
    qualitativeEnabled: configuration.qualitativeEnabled,
  };
}

function toRequest(form: ObjectivePlanningForm): ApplyObjectivePlanningConfigurationRequest {
  return {
    maxObjectiveCount: form.maxObjectiveCount,
    allowedWeights: serializeWeights(form.allowedWeights),
    quantitativeEnabled: form.quantitativeEnabled,
    qualitativeEnabled: form.qualitativeEnabled,
  };
}

function serializePlanningForm(form: ObjectivePlanningForm): string {
  return JSON.stringify({
    maxObjectiveCount: form.maxObjectiveCount,
    allowedWeights: serializeWeights(form.allowedWeights),
    quantitativeEnabled: form.quantitativeEnabled,
    qualitativeEnabled: form.qualitativeEnabled,
  });
}
