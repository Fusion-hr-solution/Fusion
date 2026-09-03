"use client";

import { useCallback, useMemo } from "react";
import { createPlatformApiClient } from "@repo/api";
import { useApiQuery, type UseApiQueryResult } from "@repo/api/query";
import { useAuth } from "@repo/auth";

/**
 * The current user's own workforce context over the shared CoreHR self-service endpoint
 * (`/corehr/workforce/me`). It is keyed by the caller's own employee id and permissioned for
 * own-profile scope, so it resolves for an ordinary organizational leader without any roster or
 * org-read grant. Performance uses it for one thing: the actor's current organizational unit, so
 * Organization Goals can center on the scope the leader is responsible for — real workforce
 * context, never a fabricated default. Only the fields this module reads are typed.
 */
export interface WorkforceMeOrgAssignment {
  orgUnitId: string;
  name: string;
  type: string;
  path: string;
  parentStableOrgUnitKey: string | null;
}

export interface WorkforceMeEmployee {
  employeeId: string;
  displayName: string;
  fullName: string;
  jobTitle: string | null;
  orgUnit: WorkforceMeOrgAssignment | null;
  directReportCount: number;
}

export interface WorkforceMeContext {
  userId: string;
  tenantId: string;
  employeeId: string | null;
  roles: string[];
  employee: WorkforceMeEmployee | null;
  isWorkforceLinked: boolean;
  /** Active headcount of the caller's own current org unit (unit only, not descendants); null if unassigned. */
  orgUnitMemberCount: number | null;
}

const WORKFORCE_ME_PATH = "/corehr/workforce/me";

/** Current viewer's workforce context — resolves their own employee record and current org unit. */
export function useWorkforceMe(enabled = true): UseApiQueryResult<WorkforceMeContext> {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) => client.get<WorkforceMeContext>(WORKFORCE_ME_PATH, { signal }),
    [client],
  );

  return useApiQuery(["workforce", "me"], queryFn, {
    enabled: isAuthenticated && enabled,
    staleTime: 60_000,
  });
}
