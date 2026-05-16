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
  EmployeeAccessFilter,
  EmployeeOrgUnitPageDto,
  EmployeeProfileDto,
  EmployeeReportingLinesDto,
  EmployeeRosterPageDto,
  EmployeeRosterQueryParams,
  EmployeeRosterSortDirection,
  EmployeeRosterSortField,
  EmployeeRosterStatus,
  EmployeeReadinessFilter,
  WorkforceReadinessSummaryDto,
} from "./employee-roster.types";

const EMPLOYEE_ROSTER_PATH = "/corehr/employees";
const ORG_UNIT_OPTIONS_PATH = "/corehr/org-units";
const MANAGER_OPTIONS_PAGE_SIZE = 8;
const ORG_UNIT_OPTIONS_PAGE_SIZE = 100;
const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";

interface UpdateEmployeeManagerInput {
  employeeId: string;
  expectedVersion: number;
  managerId: string | null;
}

interface UpdateEmployeeRecordInput {
  employeeId: string;
  expectedVersion: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  jobTitle?: string;
  orgUnitId?: string | null;
  hireDate?: string;
}

interface UpdateMyProfileInput {
  employeeId: string;
  expectedVersion: number;
  preferredName?: string | null;
}

interface DeactivateEmployeeInput {
  employeeId: string;
  expectedVersion: number;
}

export function useEmployeeRoster(
  params: EmployeeRosterQueryParams
): UseApiQueryResult<EmployeeRosterPageDto> {
  const { user, isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess = canAccessEmployeeRoster(user);
  const { access, page, pageSize, readiness, search, sortBy, sortDir, status } = params;
  const normalizedQuery = useMemo(
    () =>
      normalizeEmployeeRosterQuery({
        access,
        page,
        pageSize,
        readiness,
        search,
        sortBy,
        sortDir,
        status,
      }),
    [access, page, pageSize, readiness, search, sortBy, sortDir, status]
  );

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<EmployeeRosterPageDto>(EMPLOYEE_ROSTER_PATH, {
        signal,
        params: {
          search: normalizedQuery.search ?? undefined,
          status: normalizedQuery.status ?? undefined,
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
  const { user, isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess = canAccessEmployeeRoster(user);

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
  employeeId: string | null
): UseApiQueryResult<EmployeeReportingLinesDto> {
  const { user, isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess =
    canAccessEmployeeRoster(user) || user?.employeeId === employeeId;

  const queryFn = useCallback(
    (signal: AbortSignal) => {
      if (!employeeId) {
        throw new Error("Employee ID is required to load reporting lines.");
      }

      return client.get<EmployeeReportingLinesDto>(
        `${EMPLOYEE_ROSTER_PATH}/${employeeId}/reporting-lines`,
        {
          signal,
        }
      );
    },
    [client, employeeId]
  );

  return useApiQuery(
    employeeRosterQueryKeys.reportingLines(employeeId ?? "pending"),
    queryFn,
    {
      enabled: isAuthenticated && canAccess && !!employeeId,
    }
  );
}

export function useEmployeeManagerOptions({
  employeeId,
  search,
  enabled = true,
}: {
  employeeId: string | null;
  search: string;
  enabled?: boolean;
}): UseApiQueryResult<EmployeeRosterPageDto> {
  const { user, isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess = canAccessEmployeeRoster(user);
  const normalizedSearch = search.trim();

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<EmployeeRosterPageDto>(EMPLOYEE_ROSTER_PATH, {
        signal,
        params: {
          search: normalizedSearch,
          status: "Active",
          sortBy: "Name",
          sortDir: "Asc",
          page: 1,
          pageSize: MANAGER_OPTIONS_PAGE_SIZE,
        },
      }),
    [client, normalizedSearch]
  );

  return useApiQuery(
    employeeRosterQueryKeys.managerOptions(normalizedSearch),
    queryFn,
    {
      enabled:
        isAuthenticated &&
        canAccess &&
        enabled &&
        !!employeeId &&
        normalizedSearch.length >= 2,
    }
  );
}

export function useEmployeeOrgUnitOptions({
  search,
  enabled = true,
}: {
  search: string;
  enabled?: boolean;
}): UseApiQueryResult<EmployeeOrgUnitPageDto> {
  const { user, isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess = canAccessEmployeeRoster(user);
  const normalizedSearch = search.trim();

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<EmployeeOrgUnitPageDto>(ORG_UNIT_OPTIONS_PATH, {
        signal,
        params: {
          search: normalizedSearch || undefined,
          isActive: true,
          sortBy: "Name",
          sortDir: "Asc",
          page: 1,
          pageSize: ORG_UNIT_OPTIONS_PAGE_SIZE,
        },
      }),
    [client, normalizedSearch]
  );

  return useApiQuery(
    employeeRosterQueryKeys.orgUnitOptions(normalizedSearch),
    queryFn,
    {
      enabled: isAuthenticated && canAccess && enabled,
      placeholderData: keepPreviousData,
    }
  );
}

function buildEmployeeUpdatePayload({
  firstName,
  lastName,
  email,
  jobTitle,
  orgUnitId,
  hireDate,
}: Omit<UpdateEmployeeRecordInput, "employeeId" | "expectedVersion">) {
  const payload: Record<string, unknown> = {};

  if (firstName !== undefined) {
    payload.firstName = firstName;
  }

  if (lastName !== undefined) {
    payload.lastName = lastName;
  }

  if (email !== undefined) {
    payload.email = email;
  }

  if (jobTitle !== undefined) {
    payload.jobTitle = jobTitle;
  }

  if (orgUnitId !== undefined) {
    payload.orgUnitId = orgUnitId ?? EMPTY_GUID;
  }

  if (hireDate !== undefined) {
    payload.hireDate = hireDate;
  }

  return payload;
}

export function useResolveEmployeeRoster() {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useCallback(
    async (params: {
      search?: string;
      status?: EmployeeRosterStatus;
      access?: EmployeeAccessFilter;
      readiness?: EmployeeReadinessFilter;
      sortBy?: EmployeeRosterSortField;
      sortDir?: EmployeeRosterSortDirection;
    }) => {
      const items: EmployeeRosterPageDto["items"] = [];
      let page = 1;
      let hasNextPage = true;

      while (hasNextPage) {
        const response = await client.get<EmployeeRosterPageDto>(
          EMPLOYEE_ROSTER_PATH,
          {
            params: {
              search: params.search,
              status: params.status,
              access: params.access,
              readiness: params.readiness,
              sortBy: params.sortBy,
              sortDir: params.sortDir,
              page,
              pageSize: 100,
            },
          }
        );

        items.push(...response.items);
        hasNextPage = response.hasNextPage;
        page += 1;
      }

      return items;
    },
    [client]
  );
}

export function useUpdateEmployeeManager() {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<unknown, UpdateEmployeeManagerInput>(
    ({ employeeId, expectedVersion, managerId }) =>
      client.put(
        `${EMPLOYEE_ROSTER_PATH}/${employeeId}`,
        {
          managerId: managerId ?? EMPTY_GUID,
        },
        {
          headers: {
            "If-Match": `"${expectedVersion}"`,
          },
        }
      ),
    {
      invalidateQueries: (_data, args) => [
        { queryKey: employeeRosterQueryKeys.lists() },
        {
          queryKey: employeeRosterQueryKeys.reportingLines(args.employeeId),
          exact: true,
        },
        {
          queryKey: employeeRosterQueryKeys.profile(args.employeeId),
          exact: true,
        },
      ],
    }
  );
}

export function useUpdateEmployeeRecord() {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<unknown, UpdateEmployeeRecordInput>(
    ({ employeeId, expectedVersion, ...input }) =>
      client.put(
        `${EMPLOYEE_ROSTER_PATH}/${employeeId}`,
        buildEmployeeUpdatePayload(input),
        {
          headers: {
            "If-Match": `"${expectedVersion}"`,
          },
        }
      ),
    {
      invalidateQueries: (_data, args) => [
        { queryKey: employeeRosterQueryKeys.lists() },
        {
          queryKey: employeeRosterQueryKeys.reportingLines(args.employeeId),
          exact: true,
        },
        {
          queryKey: employeeRosterQueryKeys.profile(args.employeeId),
          exact: true,
        },
      ],
    }
  );
}

export function useUpdateMyProfile() {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<void, UpdateMyProfileInput>(
    ({ employeeId, expectedVersion, preferredName }) =>
      client.put<void>(
        `${EMPLOYEE_ROSTER_PATH}/${employeeId}/self-profile`,
        {
          preferredName,
        },
        {
          headers: {
            "If-Match": `"${expectedVersion}"`,
          },
        }
      ),
    {
      invalidateQueries: (_data, args) => [
        {
          queryKey: employeeRosterQueryKeys.profile(args.employeeId),
          exact: true,
        },
      ],
    }
  );
}

export function useDeactivateEmployee() {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<void, DeactivateEmployeeInput>(
    ({ employeeId, expectedVersion }) =>
      client.delete<void>(`${EMPLOYEE_ROSTER_PATH}/${employeeId}`, {
        headers: {
          "If-Match": `"${expectedVersion}"`,
        },
      }),
    {
      invalidateQueries: (_data, args) => [
        { queryKey: employeeRosterQueryKeys.lists() },
        {
          queryKey: employeeRosterQueryKeys.reportingLines(args.employeeId),
          exact: true,
        },
        {
          queryKey: employeeRosterQueryKeys.profile(args.employeeId),
          exact: true,
        },
      ],
    }
  );
}

export function useEmployeeProfile(
  employeeId: string | null
): UseApiQueryResult<EmployeeProfileDto> {
  const { user, isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess = canAccessEmployeeProfile(user);

  const queryFn = useCallback(
    (signal: AbortSignal) => {
      if (!employeeId) {
        throw new Error("Employee ID is required to load profile.");
      }

      return client.get<EmployeeProfileDto>(
        `${EMPLOYEE_ROSTER_PATH}/${employeeId}/profile`,
        { signal }
      );
    },
    [client, employeeId]
  );

  return useApiQuery(
    employeeRosterQueryKeys.profile(employeeId ?? "pending"),
    queryFn,
    {
      enabled: isAuthenticated && canAccess && !!employeeId,
    }
  );
}
