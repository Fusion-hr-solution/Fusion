"use client";

import { useCallback, useMemo } from "react";
import { createPlatformApiClient } from "@repo/api";
import {
  keepPreviousData,
  useApiMutation,
  useApiQuery,
  type UseApiQueryResult,
} from "@repo/api/query";
import { useAuth } from "@repo/auth";
import {
  canAccessEmployeeProfile,
  canAccessEmployeeRoster,
} from "@/lib/employee-roster-access";
import {
  employeeRosterQueryKeys,
  normalizeEmployeeRosterQuery,
} from "./employee-query-keys";
import type {
  EmployeeDetailsDto,
  EmployeeReportingLinesDto,
  EmployeeRosterPageDto,
  EmployeeRosterQueryParams,
  MyProfileContextDto,
  WorkforceReadinessSummaryDto,
} from "./employee-roster.types";

function useCanAccessRoster(): boolean {
  const { user } = useAuth();
  return canAccessEmployeeRoster(user);
}

function useCanAccessProfile(): boolean {
  const { user } = useAuth();
  return canAccessEmployeeProfile(user);
}

const EMPLOYEE_ROSTER_PATH = "/corehr/employees";

interface UpdateMyProfileInput {
  employeeId: string;
  expectedVersion: number;
  preferredName?: string | null;
  phone?: string | null;
}

export function useEmployeeRoster(
  params: EmployeeRosterQueryParams
): UseApiQueryResult<EmployeeRosterPageDto> {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess = useCanAccessRoster();
  const {
    access,
    managerId,
    orgUnitId,
    orgUnitCode,
    page,
    pageSize,
    readiness,
    search,
    sortBy,
    sortDir,
    status,
  } = params;
  const normalizedQuery = useMemo(
    () =>
      normalizeEmployeeRosterQuery({
        access,
        managerId,
        orgUnitId,
        orgUnitCode,
        page,
        pageSize,
        readiness,
        search,
        sortBy,
        sortDir,
        status,
      }),
    [
      access,
      managerId,
      orgUnitId,
      orgUnitCode,
      page,
      pageSize,
      readiness,
      search,
      sortBy,
      sortDir,
      status,
    ]
  );

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<EmployeeRosterPageDto>(EMPLOYEE_ROSTER_PATH, {
        signal,
        params: {
          search: normalizedQuery.search ?? undefined,
          status: normalizedQuery.status ?? undefined,
          orgUnitId: normalizedQuery.orgUnitId ?? undefined,
          orgUnitCode: normalizedQuery.orgUnitCode ?? undefined,
          managerId: normalizedQuery.managerId ?? undefined,
          access: normalizedQuery.access ?? undefined,
          readiness: normalizedQuery.readiness ?? undefined,
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
      normalizedQuery.access,
      normalizedQuery.managerId,
      normalizedQuery.orgUnitId,
      normalizedQuery.orgUnitCode,
      normalizedQuery.readiness,
      normalizedQuery.search,
      normalizedQuery.sortBy,
      normalizedQuery.sortDir,
      normalizedQuery.status,
    ]
  );

  return useApiQuery(
    employeeRosterQueryKeys.list({
      search: normalizedQuery.search ?? undefined,
      status: normalizedQuery.status ?? undefined,
      orgUnitId: normalizedQuery.orgUnitId ?? undefined,
      orgUnitCode: normalizedQuery.orgUnitCode ?? undefined,
      managerId: normalizedQuery.managerId ?? undefined,
      access: normalizedQuery.access ?? undefined,
      readiness: normalizedQuery.readiness ?? undefined,
      sortBy: normalizedQuery.sortBy,
      sortDir: normalizedQuery.sortDir,
      page: normalizedQuery.page,
      pageSize: normalizedQuery.pageSize,
    }),
    queryFn,
    {
      enabled: isAuthenticated && canAccess,
      placeholderData: keepPreviousData,
    }
  );
}

export function useWorkforceReadinessSummary(): UseApiQueryResult<WorkforceReadinessSummaryDto> {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess = useCanAccessRoster();

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<WorkforceReadinessSummaryDto>(
        `${EMPLOYEE_ROSTER_PATH}/readiness-summary`,
        {
          signal,
        }
      ),
    [client]
  );

  return useApiQuery(employeeRosterQueryKeys.readinessSummary(), queryFn, {
    enabled: isAuthenticated && canAccess,
  });
}

export function useEmployeeReportingLines(
  employeeKey: string | null
): UseApiQueryResult<EmployeeReportingLinesDto> {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess = useCanAccessProfile();

  const queryFn = useCallback(
    (signal: AbortSignal) => {
      if (!employeeKey) {
        throw new Error("Employee key is required to load reporting lines.");
      }

      return client.get<EmployeeReportingLinesDto>(
        `${EMPLOYEE_ROSTER_PATH}/by-key/${encodeURIComponent(employeeKey)}/reporting-lines`,
        {
          signal,
        }
      );
    },
    [client, employeeKey]
  );

  return useApiQuery(
    employeeRosterQueryKeys.reportingLines(employeeKey ?? "pending"),
    queryFn,
    {
      enabled: isAuthenticated && canAccess && !!employeeKey,
    }
  );
}

export function useUpdateMyProfile() {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<void, UpdateMyProfileInput>(
    ({ employeeId, expectedVersion, preferredName, phone }) =>
      client.put<void>(
        `${EMPLOYEE_ROSTER_PATH}/${employeeId}/self-profile`,
        {
          preferredName,
          phone,
        },
        {
          headers: {
            "If-Match": `"${expectedVersion}"`,
          },
        }
      ),
    {
      invalidateQueries: [{ queryKey: employeeRosterQueryKeys.all() }],
    }
  );
}

export function useMyProfileContext(
  enabled: boolean
): UseApiQueryResult<MyProfileContextDto> {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess = useCanAccessProfile();

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<MyProfileContextDto>(
        `${EMPLOYEE_ROSTER_PATH}/me/profile-context`,
        { signal }
      ),
    [client]
  );

  return useApiQuery(employeeRosterQueryKeys.myProfileContext(), queryFn, {
    enabled: isAuthenticated && canAccess && enabled,
  });
}

export function useEmployeeDetailsById(
  employeeId: string | null
): UseApiQueryResult<EmployeeDetailsDto> {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess = useCanAccessProfile();

  const queryFn = useCallback(
    (signal: AbortSignal) => {
      if (!employeeId) {
        throw new Error("Employee id is required to load details.");
      }

      return client.get<EmployeeDetailsDto>(
        `${EMPLOYEE_ROSTER_PATH}/${encodeURIComponent(employeeId)}`,
        { signal }
      );
    },
    [client, employeeId]
  );

  return useApiQuery(
    employeeRosterQueryKeys.detailsById(employeeId ?? "pending"),
    queryFn,
    {
      enabled: isAuthenticated && canAccess && !!employeeId,
    }
  );
}
