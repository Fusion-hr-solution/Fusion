"use client";

import { useMemo } from "react";
import {
  coreOrganizationQueryKeys,
  coreWorkforcePaths,
  coreWorkforceQueryKeys,
  createCoreOrganizationApi,
  createPlatformApiClient,
  type WorkforceEmployeeSummaryDto,
} from "@repo/api";
import { useApiQuery } from "@repo/api/query";

interface EmployeeSearchResponse {
  items: WorkforceEmployeeSummaryDto[];
}

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * The tenant organization hierarchy as of today, over the shared Core Organization
 * transport. Cached briefly and shared by any caller keyed on the same as-of date.
 * `enabled` lets a caller defer fetching until it actually needs the tree.
 */
export function useOrgHierarchy(enabled = true) {
  const organization = useMemo(
    () => createCoreOrganizationApi(createPlatformApiClient()),
    []
  );
  const asOf = todayIso();
  return useApiQuery(
    coreOrganizationQueryKeys.hierarchy(asOf),
    (signal) => organization.hierarchy(asOf, signal),
    { enabled, staleTime: 60_000 }
  );
}

/**
 * Backs the accountable-person / people picker. A term of two or more characters
 * searches; anything shorter falls back to an empty term, which the workforce endpoint
 * answers with the first page of active people — so opening the picker shows a usable
 * batch before the user types. `enabled` gates fetching to when the popup is open.
 */
export function useEmployeePicker(term: string, enabled: boolean) {
  const client = useMemo(() => createPlatformApiClient(), []);
  const trimmed = term.trim();
  const effective = trimmed.length >= 2 ? trimmed : "";
  return useApiQuery(
    [...coreWorkforceQueryKeys.all(), "workforce-picker", effective] as const,
    (signal) =>
      client.get<EmployeeSearchResponse>(coreWorkforcePaths.search(), {
        params: { search: effective || null, page: 1, pageSize: 8 },
        signal,
      }),
    { enabled, staleTime: 30_000 }
  );
}
