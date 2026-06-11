"use client";

import { useCallback, useMemo } from "react";
import { createPlatformApiClient } from "@repo/api";
import {
  useApiMutation,
  useApiQuery,
  type UseApiMutationResult,
  type UseApiQueryResult,
} from "@repo/api/query";
import { useAuth } from "@repo/auth";
import { canAccessEmployeeRoster } from "@/lib/employee-roster-access";
import { employeeRosterQueryKeys } from "./employee-query-keys";
import type {
  WorkforceAccountBulkProvisionResultDto,
  WorkforceAccountStatusDto,
  WorkforceAccountSubject,
} from "./employee-roster.types";

const WORKFORCE_ACCOUNT_PATH = "/identity/workforce-accounts";
const WORKFORCE_ACCOUNT_BATCH_SIZE = 100;

export interface ProvisionWorkforceAccountInviteInput extends WorkforceAccountSubject {
  role: "Employee" | "Manager";
}

export interface BulkProvisionWorkforceAccountInviteInput {
  items: ProvisionWorkforceAccountInviteInput[];
}

function buildStatusQueryParams(subject: WorkforceAccountSubject) {
  return {
    email: subject.email,
    firstName: subject.firstName ?? undefined,
    lastName: subject.lastName ?? undefined,
  };
}

export function useWorkforceAccountStatus(
  subject: WorkforceAccountSubject | null
): UseApiQueryResult<WorkforceAccountStatusDto> {
  const { user, isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess = canAccessEmployeeRoster(user);

  const queryFn = useCallback(
    (signal: AbortSignal) => {
      if (!subject) {
        throw new Error(
          "Employee ID is required to load workforce account status."
        );
      }

      return client.get<WorkforceAccountStatusDto>(
        `${WORKFORCE_ACCOUNT_PATH}/${subject.employeeId}`,
        {
          signal,
          params: buildStatusQueryParams(subject),
        }
      );
    },
    [client, subject]
  );

  return useApiQuery(
    employeeRosterQueryKeys.workforceAccount(
      subject ?? {
        employeeId: "pending",
        email: "pending@example.com",
      }
    ),
    queryFn,
    {
      enabled: isAuthenticated && canAccess && !!subject,
    }
  );
}

export function useWorkforceAccountStatuses(
  subjects: WorkforceAccountSubject[]
): UseApiQueryResult<WorkforceAccountStatusDto[]> {
  const { user, isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess = canAccessEmployeeRoster(user);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.post<WorkforceAccountStatusDto[]>(
        `${WORKFORCE_ACCOUNT_PATH}/statuses`,
        {
          employees: subjects.map((subject) => ({
            employeeId: subject.employeeId,
            email: subject.email,
            firstName: subject.firstName ?? undefined,
            lastName: subject.lastName ?? undefined,
          })),
        },
        { signal }
      ),
    [client, subjects]
  );

  return useApiQuery(
    employeeRosterQueryKeys.workforceAccountBatch(subjects),
    queryFn,
    {
      enabled: isAuthenticated && canAccess && subjects.length > 0,
    }
  );
}

export function useResolveWorkforceAccountStatuses() {
  const { user, isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess = canAccessEmployeeRoster(user);

  return useCallback(
    async (
      subjects: WorkforceAccountSubject[]
    ): Promise<WorkforceAccountStatusDto[]> => {
      if (!isAuthenticated || !canAccess) {
        throw new Error("Workforce account access is not available.");
      }

      if (subjects.length === 0) {
        return [];
      }

      const chunks: WorkforceAccountSubject[][] = [];
      for (
        let startIndex = 0;
        startIndex < subjects.length;
        startIndex += WORKFORCE_ACCOUNT_BATCH_SIZE
      ) {
        chunks.push(
          subjects.slice(startIndex, startIndex + WORKFORCE_ACCOUNT_BATCH_SIZE)
        );
      }

      const responses = await Promise.all(
        chunks.map((chunk) =>
          client.post<WorkforceAccountStatusDto[]>(
            `${WORKFORCE_ACCOUNT_PATH}/statuses`,
            {
              employees: chunk.map((subject) => ({
                employeeId: subject.employeeId,
                email: subject.email,
                firstName: subject.firstName ?? undefined,
                lastName: subject.lastName ?? undefined,
              })),
            }
          )
        )
      );

      return responses.flat();
    },
    [canAccess, client, isAuthenticated]
  );
}

export function useProvisionWorkforceAccountInvite(): UseApiMutationResult<
  WorkforceAccountStatusDto,
  ProvisionWorkforceAccountInviteInput
> {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<
    WorkforceAccountStatusDto,
    ProvisionWorkforceAccountInviteInput
  >(
    ({ employeeId, ...input }) =>
      client.post<WorkforceAccountStatusDto>(
        `${WORKFORCE_ACCOUNT_PATH}/${employeeId}/invite`,
        input
      ),
    {
      invalidateQueries: () => [
        { queryKey: employeeRosterQueryKeys.workforceAccounts() },
      ],
    }
  );
}

export function useBulkProvisionWorkforceAccountInvites(): UseApiMutationResult<
  WorkforceAccountBulkProvisionResultDto[],
  BulkProvisionWorkforceAccountInviteInput
> {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<
    WorkforceAccountBulkProvisionResultDto[],
    BulkProvisionWorkforceAccountInviteInput
  >(
    ({ items }) =>
      client.post<WorkforceAccountBulkProvisionResultDto[]>(
        `${WORKFORCE_ACCOUNT_PATH}/invite/bulk`,
        {
          items: items.map((item) => ({
            employeeId: item.employeeId,
            email: item.email,
            firstName: item.firstName ?? undefined,
            lastName: item.lastName ?? undefined,
            role: item.role,
          })),
        }
      ),
    {
      invalidateQueries: () => [
        { queryKey: employeeRosterQueryKeys.workforceAccounts() },
      ],
    }
  );
}

export function useResendWorkforceAccountInvite(): UseApiMutationResult<
  WorkforceAccountStatusDto,
  { employeeId: string }
> {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<WorkforceAccountStatusDto, { employeeId: string }>(
    ({ employeeId }) =>
      client.post<WorkforceAccountStatusDto>(
        `${WORKFORCE_ACCOUNT_PATH}/${employeeId}/invite/resend`,
        {}
      ),
    {
      invalidateQueries: () => [
        { queryKey: employeeRosterQueryKeys.workforceAccounts() },
      ],
    }
  );
}

export function useDeactivateWorkforceAccount(): UseApiMutationResult<
  WorkforceAccountStatusDto,
  { employeeId: string }
> {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<WorkforceAccountStatusDto, { employeeId: string }>(
    ({ employeeId }) =>
      client.post<WorkforceAccountStatusDto>(
        `${WORKFORCE_ACCOUNT_PATH}/${employeeId}/deactivate`,
        {}
      ),
    {
      invalidateQueries: () => [
        { queryKey: employeeRosterQueryKeys.workforceAccounts() },
      ],
    }
  );
}

export function useReactivateWorkforceAccount(): UseApiMutationResult<
  WorkforceAccountStatusDto,
  { employeeId: string }
> {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<WorkforceAccountStatusDto, { employeeId: string }>(
    ({ employeeId }) =>
      client.post<WorkforceAccountStatusDto>(
        `${WORKFORCE_ACCOUNT_PATH}/${employeeId}/reactivate`,
        {}
      ),
    {
      invalidateQueries: () => [
        { queryKey: employeeRosterQueryKeys.workforceAccounts() },
      ],
    }
  );
}
