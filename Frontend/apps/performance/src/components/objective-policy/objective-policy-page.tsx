"use client";

import { useMemo, useState } from "react";
import { createPlatformApiClient } from "@repo/api";
import { useApiQuery, useApiMutation } from "@repo/api/query";
import { performancePaths, performanceQueryKeys } from "@repo/api";
import { hasCorePermission, useAuth } from "@repo/auth";
import type {
  PolicySummaryDto,
  PolicyVersionDto,
  CreatePolicyDraftRequest,
} from "@repo/api";
import {
  PageContainer,
  PageHeader,
  PageLoading,
  PagePermissionNotice,
  StatusBadge,
} from "@repo/ds/shell";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PolicyDraftEditor } from "./policy-draft-editor";
import { PolicyVersionDetail } from "./policy-version-detail";
import { PolicyHistory } from "./policy-history";
import { toast } from "sonner";

type View = "summary" | "edit" | "history";

// §7.2 baseline defaults
const POLICY_DEFAULTS: CreatePolicyDraftRequest = {
  maxObjectivesPerPlan: 7,
  allowedWeightValues: "5,10,15,20,25,30,40,50",
  managerValidationSlaDays: 10,
  cascadeMode: "Optional",
  measurementTypes: "Quantitative,Qualitative",
  attachmentsEnabled: true,
};

export function ObjectivePolicyPage() {
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const [view, setView] = useState<View>("summary");
  const { user, isLoading: authLoading } = useAuth();
  const canView =
    hasCorePermission(user, "performance.objective.policy.view", "Tenant") ||
    hasCorePermission(user, "performance.objective.policy.manage", "Tenant");
  const canManage = hasCorePermission(user, "performance.objective.policy.manage", "Tenant");

  const {
    data: policy,
    isLoading,
    error,
    refetch,
  } = useApiQuery<PolicySummaryDto>(
    performanceQueryKeys.policy(),
    (signal) => apiClient.get<PolicySummaryDto>(performancePaths.policy(), { signal }),
  );

  const createDraft = useApiMutation<PolicyVersionDto, CreatePolicyDraftRequest>(
    (data) => apiClient.post<PolicyVersionDto>(performancePaths.policyDraft(), data),
    {
      onSuccess: () => {
        toast.success("Policy draft created");
        void refetch();
        setView("edit");
      },
      onError: (err) => { toast.error(err.message); },
    },
  );

  const discardDraft = useApiMutation<void, void>(
    () => apiClient.delete<void>(performancePaths.policyDraft()).then(() => undefined),
    {
      onSuccess: () => {
        toast.success("Draft discarded");
        void refetch();
        setView("summary");
      },
      onError: (err) => { toast.error(err.message); },
    },
  );

  if (authLoading) return <PageLoading label="Loading…" />;

  if (!canView) {
    return (
      <PageContainer>
        <PagePermissionNotice
          title="Access restricted"
          description="You do not have access to objective policy settings for this tenant."
        />
      </PageContainer>
    );
  }

  if (isLoading) return <PageLoading rows={4} />;

  const isEmpty = !policy && !!error;

  return (
    <PageContainer>
      <PageHeader
        title="Objective policy"
        description="These settings belong to this tenant and apply as defaults for future campaigns."
        actions={
          view !== "history" && !isEmpty ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setView("history")}
            >
              View history
            </Button>
          ) : undefined
        }
      />

      {view === "history" ? (
        <PolicyHistory apiClient={apiClient} onBack={() => setView("summary")} />
      ) : view === "edit" && policy?.draftVersion ? (
        <PolicyDraftEditor
          draft={policy.draftVersion}
          activeVersion={policy.activeVersion ?? null}
          onSaved={() => { void refetch(); setView("summary"); }}
          onDiscard={() => discardDraft.mutate()}
          isDiscarding={discardDraft.isLoading}
        />
      ) : (
        <SummaryView
          policy={policy}
          isEmpty={isEmpty}
          onEdit={() => {
            if (!canManage) {
              toast.error("You do not have permission to edit the objective policy.");
              return;
            }
            if (policy?.draftVersion) {
              setView("edit");
            } else {
              createDraft.mutate(
                policy?.activeVersion
                  ? {
                      maxObjectivesPerPlan: policy.activeVersion.maxObjectivesPerPlan,
                      allowedWeightValues: policy.activeVersion.allowedWeightValues,
                      managerValidationSlaDays: policy.activeVersion.managerValidationSlaDays,
                      cascadeMode: policy.activeVersion.cascadeMode,
                      measurementTypes: policy.activeVersion.measurementTypes,
                      attachmentsEnabled: policy.activeVersion.attachmentsEnabled,
                    }
                  : POLICY_DEFAULTS,
              );
            }
          }}
          isCreatingDraft={createDraft.isLoading}
          canManage={canManage}
        />
      )}
    </PageContainer>
  );
}

function SummaryView({
  policy,
  isEmpty,
  onEdit,
  isCreatingDraft,
  canManage,
}: {
  policy: PolicySummaryDto | undefined;
  isEmpty: boolean;
  onEdit: () => void;
  isCreatingDraft: boolean;
  canManage: boolean;
}) {
  if (isEmpty || (!policy?.activeVersion && !policy?.draftVersion)) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            No objective policy has been set up for this tenant yet.
          </p>
          <Button
            size="sm"
            onClick={onEdit}
            disabled={isCreatingDraft || !canManage}
          >
            {isCreatingDraft ? "Creating…" : "Set up policy"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {policy?.draftVersion && (
        <Card className="border-dashed border-primary/40">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-medium">Unpublished changes</span>
              <StatusBadge tone="warning" dot>Draft</StatusBadge>
              <span className="text-xs text-muted-foreground ml-auto">v{policy.draftVersion.versionNumber}</span>
            </div>
            <PolicyVersionDetail version={policy.draftVersion} />
          </CardContent>
          <CardFooter>
            <Button size="sm" onClick={onEdit} disabled={!canManage}>
              Edit draft
            </Button>
          </CardFooter>
        </Card>
      )}

      {policy?.activeVersion && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-medium">Current policy</span>
              <StatusBadge tone="success" dot>Active</StatusBadge>
              <span className="text-xs text-muted-foreground ml-auto">v{policy.activeVersion.versionNumber}</span>
            </div>
            <PolicyVersionDetail version={policy.activeVersion} />
          </CardContent>
          {!policy.draftVersion && (
            <CardFooter>
              <Button
                size="sm"
                variant="outline"
                onClick={onEdit}
                disabled={isCreatingDraft || !canManage}
              >
                {isCreatingDraft ? "Creating draft…" : "Edit policy"}
              </Button>
            </CardFooter>
          )}
        </Card>
      )}
    </div>
  );
}
