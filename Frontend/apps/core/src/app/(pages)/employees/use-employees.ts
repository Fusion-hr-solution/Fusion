"use client";

import { useCallback, useMemo } from "react";
import { createPlatformApiClient } from "@repo/api";
import {
  keepPreviousData,
  useApiQuery,
  type UseApiQueryResult,
} from "@repo/api/query";
import { useAuth } from "@repo/auth";
import { canAccessEmployeeRoster } from "@/lib/employee-roster-access";
import {
  employeeRosterQueryKeys,
  normalizeEmployeeRosterQuery,
} from "./employee-query-keys";
import type {
  EmployeeRosterPageDto,
  EmployeeRosterQueryParams,
} from "./employee-roster.types";

const EMPLOYEE_ROSTER_PATH = "/corehr/employees";

export function useEmployeeRoster(
  params: EmployeeRosterQueryParams
): UseApiQueryResult<EmployeeRosterPageDto> {
  const { user, isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess = canAccessEmployeeRoster(user);
  const normalizedQuery = useMemo(
    () => normalizeEmployeeRosterQuery(params),
    [
      params.page,
      params.pageSize,
      params.search,
      params.sortBy,
      params.sortDir,
      params.status,
    ]
  );

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<EmployeeRosterPageDto>(EMPLOYEE_ROSTER_PATH, {
        signal,
        params: {
          search: normalizedQuery.search ?? undefined,
          status: normalizedQuery.status ?? undefined,
          sortBy: normalizedQuery.sortBy,
          sortDir: normalizedQuery.sortDir,
          page: normalizedQuery.page,
          pageSize: normalizedQuery.pageSize,
        },
      }),
    [
      client,
      normalizedQuery.page,
      normalizedQuery.pageSize,
      normalizedQuery.search,
      normalizedQuery.sortBy,
      normalizedQuery.sortDir,
      normalizedQuery.status,
    ]
  );

  return useApiQuery(employeeRosterQueryKeys.list(params), queryFn, {
    enabled: isAuthenticated && canAccess,
    placeholderData: keepPreviousData,
  });
}
