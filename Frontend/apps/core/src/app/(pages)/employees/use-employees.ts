"use client";

import { useCallback, useMemo } from "react";
import { createPlatformApiClient } from "@repo/api";
import {
  useApiQuery,
  type UseApiQueryResult,
} from "@repo/api/react";
import { useAuth } from "@repo/auth";
import { canAccessEmployeeRoster } from "@/lib/employee-roster-access";
import type {
  EmployeeRosterPageDto,
  EmployeeRosterQueryParams,
} from "./employee-roster.types";

const EMPLOYEE_ROSTER_PATH = "/corehr/employees";

function normalizeSearch(search?: string): string | undefined {
  const trimmed = search?.trim();
  return trimmed ? trimmed : undefined;
}

export function useEmployeeRoster(
  params: EmployeeRosterQueryParams
): UseApiQueryResult<EmployeeRosterPageDto> {
  const { user, isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess = canAccessEmployeeRoster(user);
  const normalizedSearch = normalizeSearch(params.search);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<EmployeeRosterPageDto>(EMPLOYEE_ROSTER_PATH, {
        signal,
        params: {
          search: normalizedSearch,
          status: params.status,
          sortBy: params.sortBy,
          sortDir: params.sortDir,
          page: params.page,
          pageSize: params.pageSize,
        },
      }),
    [
      client,
      normalizedSearch,
      params.page,
      params.pageSize,
      params.sortBy,
      params.sortDir,
      params.status,
    ]
  );

  return useApiQuery(queryFn, {
    enabled: isAuthenticated && canAccess,
  });
}