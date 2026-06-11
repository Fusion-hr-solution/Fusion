"use client";

import { useCallback, useMemo } from "react";
import { createPlatformApiClient } from "@repo/api";
import {
  keepPreviousData,
  useApiMutation,
  useApiQuery,
  type UseApiQueryResult,
} from "@repo/api/query";
import type { AuthUser } from "@repo/auth";
import { useAuth } from "@repo/auth";
import { useTenantContext } from "@/components/core-tenant-context-provider";
import {
  canAccessEmployeeProfile,
  canAccessEmployeeRoster,
  canAccessTeamWorkspace,
} from "@/lib/employee-roster-access";
import {
  employeeRosterQueryKeys,
  normalizeEmployeeRosterQuery,
} from "./employee-query-keys";
import type {
  EmployeeOrgUnitPageDto,
  EmployeeProfileDto,
  EmployeeReportingLinesDto,
  EmployeeRosterItem,
  EmployeeRosterPageDto,
  EmployeeRosterQueryParams,
  WorkforceReadinessSummaryDto,
} from "./employee-roster.types";

function useCanAccessRoster(): boolean {
  const { user } = useAuth();
  const { tenantId } = useTenantContext();
  return canAccessEmployeeRoster(user) || (!!user?.roles.includes("PlatformAdmin") && !!tenantId);
}

function useCanAccessProfile(): boolean {
  const { user } = useAuth();
  const { tenantId } = useTenantContext();
  return canAccessEmployeeProfile(user) || (!!user?.roles.includes("PlatformAdmin") && !!tenantId);
}

const EMPLOYEE_ROSTER_PATH = "/corehr/employees";
const ORG_UNIT_OPTIONS_PATH = "/corehr/org-units";
const MANAGER_OPTIONS_PAGE_SIZE = 8;
const ORG_UNIT_OPTIONS_PAGE_SIZE = 100;
const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";
const EMPLOYEE_RESOLVE_PAGE_SIZE = 100;
const EMPLOYEE_ROSTER_PATH_SEGMENT = "/corehr/employees/";

function getScopeFromPath(path: string): string {
  const relative = path.startsWith(EMPLOYEE_ROSTER_PATH_SEGMENT)
    ? path.slice(EMPLOYEE_ROSTER_PATH_SEGMENT.length)
    : path;
  const segment = relative.split("/")[0];
  if (segment === "me") return "me";
  if (segment === "team") return "team";
  return "roster";
}

function resolveEmployeeProfilePath(
  user: AuthUser | null,
  employeeId: string | null
): string | null {
  if (!user || !employeeId) {
    return null;
  }

  if (canAccessEmployeeRoster(user)) {
    return `${EMPLOYEE_ROSTER_PATH}/${employeeId}/profile`;
  }

  if (user.employeeId === employeeId) {
    return `${EMPLOYEE_ROSTER_PATH}/me/profile`;
  }

  if (canAccessTeamWorkspace(user)) {
    return `${EMPLOYEE_ROSTER_PATH}/team/${employeeId}/profile`;
  }

  return null;
}

function resolveEmployeeReportingLinesPath(
  user: AuthUser | null,
  employeeId: string | null
): string | null {
  if (!user || !employeeId) {
    return null;
  }

  if (canAccessEmployeeRoster(user)) {
    return `${EMPLOYEE_ROSTER_PATH}/${employeeId}/reporting-lines`;
  }

  if (user.employeeId === employeeId) {
    return `${EMPLOYEE_ROSTER_PATH}/me/reporting-lines`;
  }

  if (canAccessTeamWorkspace(user)) {
    return `${EMPLOYEE_ROSTER_PATH}/team/${employeeId}/reporting-lines`;
  }

  return null;
}

interface UpdateEmployeeManagerInput {
  employeeId: string;
  expectedVersion: number;
  managerId: string | null;
}

interface UpdateEmployeeRecordInput {
  employeeId: string;
  expectedVersion: number;
  employeeNumber?: string | null;
  firstName?: string;
  lastName?: string;
  email?: string;
  jobTitle?: string;
  orgUnitId?: string | null;
  hireDate?: string;
}

interface DeactivateEmployeeInput {
  employeeId: string;
  expectedVersion: number;
}

interface UpdateMyProfileInput {
  employeeId: string;
  expectedVersion: number;
  preferredName: string | null;
}

export function useEmployeeRoster(
  params: EmployeeRosterQueryParams
): UseApiQueryResult<EmployeeRosterPageDto> {
  const { user, isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess = canAccessEmployeeRoster(user);
  const { access, page, pageSize, readiness, search, sortBy, sortDir, status } =
    params;
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
      normalizedQuery.access,
      normalizedQuery.page,
      normalizedQuery.pageSize,
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

export function useResolveEmployeeRoster() {
  const { user, isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess = canAccessEmployeeRoster(user);

  return useCallback(
    async (
      params: Omit<EmployeeRosterQueryParams, "page" | "pageSize">
    ): Promise<EmployeeRosterItem[]> => {
      if (!isAuthenticated || !canAccess) {
        throw new Error("Employee roster access is not available.");
      }

      const normalizedQuery = normalizeEmployeeRosterQuery({
        ...params,
        page: 1,
        pageSize: EMPLOYEE_RESOLVE_PAGE_SIZE,
      });
      const employees: EmployeeRosterItem[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const response = await client.get<EmployeeRosterPageDto>(
          EMPLOYEE_ROSTER_PATH,
          {
            params: {
              search: normalizedQuery.search ?? undefined,
              status: normalizedQuery.status ?? undefined,
              access: normalizedQuery.access ?? undefined,
              readiness: normalizedQuery.readiness ?? undefined,
              sortBy: normalizedQuery.sortBy,
              sortDir: normalizedQuery.sortDir,
              page,
              pageSize: EMPLOYEE_RESOLVE_PAGE_SIZE,
            },
          }
        );

        employees.push(...response.items);
        totalPages = Math.max(response.totalPages, 1);
        page += 1;
      } while (page <= totalPages);

      return employees;
    },
    [canAccess, client, isAuthenticated]
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

export function useMyTeam(
  params: EmployeeRosterQueryParams
): UseApiQueryResult<EmployeeRosterPageDto> {
  const { user, isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess = canAccessTeamWorkspace(user);
  const { page, pageSize, readiness, search, sortBy, sortDir, status } = params;
  const normalizedQuery = useMemo(
    () =>
      normalizeEmployeeRosterQuery({
        page,
        pageSize,
        readiness,
        search,
        sortBy,
        sortDir,
        status,
      }),
    [page, pageSize, readiness, search, sortBy, sortDir, status]
  );

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<EmployeeRosterPageDto>(`${EMPLOYEE_ROSTER_PATH}/me/team`, {
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

  return useApiQuery(
    employeeRosterQueryKeys.team({
      search: normalizedQuery.search ?? undefined,
      status: normalizedQuery.status ?? undefined,
      readiness: undefined,
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

export function useEmployeeReportingLines(
  employeeId: string | null
): UseApiQueryResult<EmployeeReportingLinesDto> {
  const { user, isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess = canAccessEmployeeProfile(user);
  const reportingLinesPath = useMemo(
    () => resolveEmployeeReportingLinesPath(user, employeeId),
    [user, employeeId]
  );

  const queryFn = useCallback(
    (signal: AbortSignal) => {
      if (!reportingLinesPath) {
        throw new Error("Employee ID is required to load reporting lines.");
      }

      return client.get<EmployeeReportingLinesDto>(reportingLinesPath, {
        signal,
      });
    },
    [client, reportingLinesPath]
  );

  return useApiQuery(
    employeeRosterQueryKeys.reportingLines(
      employeeId ?? "pending",
      reportingLinesPath ? getScopeFromPath(reportingLinesPath) : undefined),
    queryFn,
    {
      enabled: isAuthenticated && canAccess && !!reportingLinesPath,
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
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess = useCanAccessRoster();
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
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess = useCanAccessRoster();
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
  employeeNumber,
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

  if (employeeNumber !== undefined) {
    payload.employeeNumber = employeeNumber?.trim() || null;
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

export function useUpdateMyProfile() {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<EmployeeProfileDto, UpdateMyProfileInput>(
    ({ employeeId, expectedVersion, preferredName }) =>
      client.patch<EmployeeProfileDto>(
        `${EMPLOYEE_ROSTER_PATH}/me`,
        { preferredName },
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

export function useEmployeeProfile(
  employeeId: string | null
): UseApiQueryResult<EmployeeProfileDto> {
  const { user, isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess = canAccessEmployeeProfile(user);
  const profilePath = useMemo(
    () => resolveEmployeeProfilePath(user, employeeId),
    [user, employeeId]
  );

  const queryFn = useCallback(
    (signal: AbortSignal) => {
      if (!profilePath) {
        throw new Error("Employee ID is required to load profile.");
      }

      return client.get<EmployeeProfileDto>(profilePath, { signal });
    },
    [client, profilePath]
  );

  return useApiQuery(
    employeeRosterQueryKeys.profile(
      employeeId ?? "pending",
      profilePath ? getScopeFromPath(profilePath) : undefined),
    queryFn,
    {
      enabled: isAuthenticated && canAccess && !!profilePath,
    }
  );
}
