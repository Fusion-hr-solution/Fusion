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
import { useTenantContext } from "@/shell/tenant-context/core-tenant-context-provider";
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
  EmployeeOrgUnitPageDto,
  EmployeeReportingLinesDto,
  EmployeeRosterItem,
  EmployeeRosterPageDto,
  EmployeeRosterQueryParams,
  WorkforceReadinessSummaryDto,
} from "./employee-roster.types";

function useCanAccessRoster(): boolean {
  const { user } = useAuth();
  const { tenantId } = useTenantContext();
  return (
    canAccessEmployeeRoster(user) ||
    (!!user?.roles.includes("PlatformAdmin") && !!tenantId)
  );
}

function useCanAccessProfile(): boolean {
  const { user } = useAuth();
  const { tenantId } = useTenantContext();
  return (
    canAccessEmployeeProfile(user) ||
    (!!user?.roles.includes("PlatformAdmin") && !!tenantId)
  );
}

const EMPLOYEE_ROSTER_PATH = "/corehr/employees";
const ORG_UNIT_OPTIONS_PATH = "/corehr/org-units";
const MANAGER_OPTIONS_PAGE_SIZE = 100;
const ORG_UNIT_OPTIONS_PAGE_SIZE = 100;
const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";

interface ChangeEmployeeManagerInput {
  employeeId: string;
  expectedVersion: number;
  managerId: string;
  effectiveDate: string;
}

interface UpdateEmployeeRecordInput {
  employeeId: string;
  expectedVersion: number;
  employeeNumber?: string | null;
  firstName?: string;
  lastName?: string;
  preferredName?: string | null;
  email?: string;
  phone?: string | null;
  jobTitle?: string;
  workLocation?: string | null;
  employmentType?: string | null;
  orgUnitId?: string | null;
}

interface UpdateMyProfileInput {
  employeeId: string;
  expectedVersion: number;
  preferredName?: string | null;
  phone?: string | null;
}

interface CreateEmployeeInput {
  firstName: string;
  lastName: string;
  email: string;
  hireDate: string;
  jobTitle?: string | null;
  managerId?: string | null;
  orgUnitId?: string | null;
}


interface TerminateEmployeeInput {
  employeeId: string;
  expectedVersion: number;
  effectiveDate: string;
  note?: string | null;
}

interface RehireEmployeeInput {
  employeeId: string;
  expectedVersion: number;
  effectiveDate: string;
  orgUnitId: string;
  jobTitle: string;
  workLocation?: string | null;
  managerId?: string | null;
  employmentType?: string | null;
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
          search: normalizedSearch || undefined,
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
      enabled: isAuthenticated && canAccess && enabled,
      placeholderData: keepPreviousData,
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
  preferredName,
  email,
  phone,
  jobTitle,
  workLocation,
  employmentType,
  orgUnitId,
}: Omit<UpdateEmployeeRecordInput, "employeeId" | "expectedVersion">) {
  const payload: Record<string, unknown> = {};

  if (employeeNumber !== undefined) {
    payload.employeeNumber = employeeNumber?.trim() || null;
  }

  if (firstName !== undefined) {
    payload.firstName = firstName;
  }

  if (lastName !== undefined) {
    payload.lastName = lastName;
  }

  if (preferredName !== undefined) {
    payload.preferredName = preferredName?.trim() ?? "";
  }

  if (email !== undefined) {
    payload.email = email;
  }

  if (phone !== undefined) {
    payload.phone = phone?.trim() || null;
  }

  if (jobTitle !== undefined) {
    payload.jobTitle = jobTitle;
  }

  if (workLocation !== undefined) {
    payload.workLocation = workLocation?.trim() || null;
  }

  if (employmentType !== undefined) {
    payload.employmentType = employmentType?.trim() || null;
  }

  if (orgUnitId !== undefined) {
    payload.orgUnitId = orgUnitId ?? EMPTY_GUID;
  }

  return payload;
}

export function useChangeEmployeeManager() {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<EmployeeDetailsDto, ChangeEmployeeManagerInput>(
    ({ employeeId, expectedVersion, managerId, effectiveDate }) =>
      client.post<EmployeeDetailsDto>(
        `${EMPLOYEE_ROSTER_PATH}/${employeeId}/change-manager`,
        { managerId, effectiveDate },
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

export function useCreateEmployeeRecord() {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<EmployeeDetailsDto, CreateEmployeeInput>(
    ({
      firstName,
      lastName,
      email,
      hireDate,
      jobTitle,
      managerId,
      orgUnitId,
    }) => {
      const payload: Record<string, string> = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        hireDate,
      };

      if (jobTitle?.trim()) {
        payload.jobTitle = jobTitle.trim();
      }

      if (managerId) {
        payload.managerId = managerId;
      }

      if (orgUnitId) {
        payload.orgUnitId = orgUnitId;
      }

      return client.post<EmployeeDetailsDto>(
        EMPLOYEE_ROSTER_PATH,
        payload
      );
    },
    {
      invalidateQueries: [{ queryKey: employeeRosterQueryKeys.all() }],
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
      invalidateQueries: [{ queryKey: employeeRosterQueryKeys.all() }],
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

export function useTerminateEmployee() {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<EmployeeDetailsDto, TerminateEmployeeInput>(
    ({ employeeId, expectedVersion, effectiveDate, note }) =>
      client.post<EmployeeDetailsDto>(
        `${EMPLOYEE_ROSTER_PATH}/${employeeId}/terminate`,
        { effectiveDate, note: note ?? null },
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

export function useRehireEmployee() {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<EmployeeDetailsDto, RehireEmployeeInput>(
    ({ employeeId, expectedVersion, effectiveDate, orgUnitId, jobTitle, workLocation, managerId, employmentType }) =>
      client.post<EmployeeDetailsDto>(
        `${EMPLOYEE_ROSTER_PATH}/${employeeId}/rehire`,
        {
          effectiveDate,
          orgUnitId,
          jobTitle,
          workLocation: workLocation ?? null,
          managerId: managerId ?? null,
          employmentType: employmentType ?? null,
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

export function useEmployeeDetails(
  employeeKey: string | null
): UseApiQueryResult<EmployeeDetailsDto> {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess = useCanAccessProfile();

  const queryFn = useCallback(
    (signal: AbortSignal) => {
      if (!employeeKey) {
        throw new Error("Employee key is required to load details.");
      }

      return client.get<EmployeeDetailsDto>(
        `${EMPLOYEE_ROSTER_PATH}/by-key/${encodeURIComponent(employeeKey)}`,
        { signal }
      );
    },
    [client, employeeKey]
  );

  return useApiQuery(
    employeeRosterQueryKeys.details(employeeKey ?? "pending"),
    queryFn,
    {
      enabled: isAuthenticated && canAccess && !!employeeKey,
    }
  );
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
