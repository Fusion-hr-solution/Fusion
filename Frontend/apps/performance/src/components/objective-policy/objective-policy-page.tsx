"use client";

import { useMemo, useState } from "react";
import { ApiError, createPlatformApiClient } from "@repo/api";
import { useApiQuery } from "@repo/api/query";
import { performancePaths, performanceQueryKeys } from "@repo/api";
import { hasCorePermission, useAuth } from "@repo/auth";
import type { PolicySummaryDto } from "@repo/api";
import {
  PageContainer,
  PageError,
  PageHeader,
  PageLoading,
  PagePermissionNotice,
  StatusBadge,
} from "@repo/ds/shell";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PolicyApplyEditor } from "./policy-apply-editor";
import { PolicyVersionDetail } from "./policy-version-detail";
import { PolicyHistory } from "./policy-history";
import { toast } from "sonner";

type View = "summary" | "edit" | "history";

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
    { enabled: canView },
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

  // A genuinely un-provisioned tenant returns 404 (ObjectivePolicy.NotFound). Any
  // other error is a real load failure and must be recoverable — never presented
  // as an empty "set up policy" state, which would mask the failure.
  const isNotProvisioned = error instanceof ApiError && error.status === 404;
  const isForbidden = error instanceof ApiError && error.status === 403;

  if (isForbidden) {
    return (
      <PageContainer>
        <PagePermissionNotice
          title="Access restricted"
          description="You do not have access to objective policy settings for this tenant."
        />
      </PageContainer>
    );
  }

  if (error && !isNotProvisioned) {
    return (
      <PageContainer>
        <PageHeader title="Objective policy" />
        <PageError
          title="Couldn't load the objective policy"
          description="Something went wrong. Try again."
          onRetry={() => void refetch()}
        />
      </PageContainer>
    );
  }

  const isEmpty = isNotProvisioned;

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
      ) : view === "edit" && policy?.currentPolicy ? (
        <PolicyApplyEditor
          currentPolicy={policy.currentPolicy}
          onApplied={() => { void refetch(); setView("summary"); }}
          onCancel={() => setView("summary")}
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
            if (policy?.currentPolicy) {
              setView("edit");
            }
          }}
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
  canManage,
}: {
  policy: PolicySummaryDto | undefined;
  isEmpty: boolean;
  onEdit: () => void;
  canManage: boolean;
}) {
  if (isEmpty || !policy?.currentPolicy) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            No objective policy has been provisioned for this tenant yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {policy.currentPolicy && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-medium">Current policy</span>
              <StatusBadge tone="success" dot>Active</StatusBadge>
              <span className="text-xs text-muted-foreground ml-auto">v{policy.currentPolicy.versionNumber}</span>
            </div>
            <PolicyVersionDetail version={policy.currentPolicy} />
          </CardContent>
          <CardFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={onEdit}
              disabled={!canManage}
            >
              Edit policy
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
