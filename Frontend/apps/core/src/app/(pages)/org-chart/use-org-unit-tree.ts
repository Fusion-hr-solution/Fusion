"use client";

import { useCallback, useMemo } from "react";
import { createPlatformApiClient } from "@repo/api";
import {
  keepPreviousData,
  useApiQuery,
  type UseApiQueryResult,
} from "@repo/api/query";
import {
  canAccessCoreOrgChart,
  PLATFORM_ADMIN_ROLE,
  useAuth,
} from "@repo/auth";
import { useTenantContext } from "@/shell/tenant-context/core-tenant-context-provider";
import {
  normalizeOrgUnitTreeQuery,
  orgUnitTreeQueryKeys,
} from "./org-chart-query-keys";
import type {
  OrgUnitTreeNodeDto,
  OrgUnitTreeQueryParams,
} from "./org-chart.types";

const ORG_UNIT_TREE_PATH = "/corehr/org-units/tree";

/**
 * Org-unit (structure) tree for the org chart's Structure lens. Reuses the same access
 * gate as the people lens; the server enforces `CanViewStructure` on the endpoint.
 */
export function useOrgUnitTree(
  query?: OrgUnitTreeQueryParams,
  enabled = true
): UseApiQueryResult<OrgUnitTreeNodeDto[]> {
  const { user, isAuthenticated } = useAuth();
  const { tenantId } = useTenantContext();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess =
    canAccessCoreOrgChart(user) ||
    (!!user?.roles.includes(PLATFORM_ADMIN_ROLE) && !!tenantId);
  const normalizedQuery = normalizeOrgUnitTreeQuery(query);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<OrgUnitTreeNodeDto[]>(ORG_UNIT_TREE_PATH, {
        signal,
        params: {
          rootId: normalizedQuery.rootId ?? undefined,
          maxDepth: normalizedQuery.maxDepth,
          includeInactive: normalizedQuery.includeInactive || undefined,
        },
      }),
    [
      client,
      normalizedQuery.rootId,
      normalizedQuery.maxDepth,
      normalizedQuery.includeInactive,
    ]
  );

  return useApiQuery(orgUnitTreeQueryKeys.tree(normalizedQuery), queryFn, {
    enabled: isAuthenticated && canAccess && enabled,
    placeholderData: keepPreviousData,
  });
}
