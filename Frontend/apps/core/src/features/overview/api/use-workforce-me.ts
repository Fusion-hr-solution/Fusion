"use client";

import { useCallback, useMemo } from "react";
import { createPlatformApiClient } from "@repo/api";
import { useApiQuery, type UseApiQueryResult } from "@repo/api/query";
import { useAuth } from "@repo/auth";

// Mirrors CoreHR WorkforceController DTOs (workforce/me, workforce/employees/{id}/team).
// These self-service endpoints are keyed by employee id (not stable key) and are
// permissioned for own-profile / team scope — so they work for managers and leaf
// employees without roster access.

export interface WorkforceOrgAssignment {
  name: string;
  type: string;
  path: string;
}

export interface WorkforceManagerSummary {
  employeeId: string;
  displayName: string;
  email: string;
  isActive: boolean;
}

export interface WorkforceDataQuality {
  state: string;
  hasEmployeeStateIssues: boolean;
  hasOperationalBlockers: boolean;
  issueCodes: string[];
}

export interface WorkforceEmployeeSummary {
  employeeId: string;
  stableEmployeeKey: string;
  employeeNumber: string | null;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  displayName: string;
  fullName: string;
  workEmail: string;
  jobTitle: string | null;
  hireDate: string;
  employmentStatus: string;
  isActive: boolean;
  orgUnit: WorkforceOrgAssignment | null;
  manager: WorkforceManagerSummary | null;
  directReportCount: number;
  dataQuality: WorkforceDataQuality;
}

export interface WorkforceManagerScope {
  scopeType: string;
  managerEmployeeId: string;
  directReportCount: number;
  includesIndirectReports: boolean;
}

export interface WorkforceMeContext {
  userId: string;
  tenantId: string;
  employeeId: string | null;
  roles: string[];
  employee: WorkforceEmployeeSummary | null;
  managerScope: WorkforceManagerScope | null;
  isWorkforceLinked: boolean;
  publishedStructureVersion: number;
  isStructureOperational: boolean;
}

const WORKFORCE_PATH = "/corehr/workforce";

/** Current user's workforce context (self profile + manager scope). Resolves the user's
 *  own employee record by id — no roster access or stable key required. */
export function useWorkforceMe(enabled = true): UseApiQueryResult<WorkforceMeContext> {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<WorkforceMeContext>(`${WORKFORCE_PATH}/me`, { signal }),
    [client]
  );

  return useApiQuery(["workforce", "me"], queryFn, {
    enabled: isAuthenticated && enabled,
  });
}

/** A manager's team (direct reports), keyed by the manager's employee id. */
export function useWorkforceTeam(
  employeeId: string | null,
  enabled = true
): UseApiQueryResult<WorkforceEmployeeSummary[]> {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) => {
      if (!employeeId) throw new Error("Employee id is required to load team.");
      return client.get<WorkforceEmployeeSummary[]>(
        `${WORKFORCE_PATH}/employees/${employeeId}/team`,
        { signal }
      );
    },
    [client, employeeId]
  );

  return useApiQuery(["workforce", "team", employeeId ?? "pending"], queryFn, {
    enabled: isAuthenticated && enabled && !!employeeId,
  });
}
