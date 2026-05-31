"use client";

import { useCallback, useMemo } from "react";
import {
  coreAccessQueryKeys,
  coreWorkforceQueryKeys,
  createPlatformApiClient,
} from "@repo/api";
import { useApiMutation, useApiQuery } from "@repo/api/query";
import { employeeRosterQueryKeys } from "./employee-query-keys";
import type {
  WorkforceAccountBulkProvisionResultDto,
  WorkforceAccountStatusDto,
  WorkforceAccountSubject,
} from "./employee-roster.types";

const WORKFORCE_ACCOUNTS_PATH = "/corehr/employees/workforce-accounts";
const WORKFORCE_ACCOUNT_STATUSES_PATH = `${WORKFORCE_ACCOUNTS_PATH}/statuses`;
const WORKFORCE_ACCOUNT_STATUS_BATCH_SIZE = 200;
const EMPTY_WORKFORCE_ACCOUNT_STATUSES: WorkforceAccountStatusDto[] = [];
const WORKFORCE_ACCOUNT_MUTATION_INVALIDATIONS = [
  { queryKey: coreWorkforceQueryKeys.all() },
  { queryKey: employeeRosterQueryKeys.workforceAccounts() },
  { queryKey: coreAccessQueryKeys.profiles() },
];
const BULK_WORKFORCE_ACCOUNT_MUTATION_INVALIDATIONS = [
  ...WORKFORCE_ACCOUNT_MUTATION_INVALIDATIONS,
  { queryKey: employeeRosterQueryKeys.lists() },
];

export function useWorkforceAccountStatuses(
  subjects: WorkforceAccountSubject[]
) {
  const client = useMemo(() => createPlatformApiClient(), []);
  const subjectKey = useMemo(
    () => subjects.map((subject) => subject.employeeId).join("|"),
    [subjects]
  );
  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.post<WorkforceAccountStatusDto[]>(
        WORKFORCE_ACCOUNT_STATUSES_PATH,
        { subjects },
        { signal }
      ),
    [client, subjects]
  );

  return useApiQuery(
    [...employeeRosterQueryKeys.workforceAccounts(), subjectKey] as const,
    queryFn,
    {
      enabled: subjects.length > 0,
      placeholderData: EMPTY_WORKFORCE_ACCOUNT_STATUSES,
    }
  );
}

export function useResolveWorkforceAccountStatuses() {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useCallback(
    async (subjects: WorkforceAccountSubject[]) => {
      if (subjects.length === 0) {
        return [] as WorkforceAccountStatusDto[];
      }

      const results: WorkforceAccountStatusDto[] = [];

      for (
        let index = 0;
        index < subjects.length;
        index += WORKFORCE_ACCOUNT_STATUS_BATCH_SIZE
      ) {
        const batch = subjects.slice(
          index,
          index + WORKFORCE_ACCOUNT_STATUS_BATCH_SIZE
        );

        const batchResults = await client.post<WorkforceAccountStatusDto[]>(
          WORKFORCE_ACCOUNT_STATUSES_PATH,
          { subjects: batch }
        );

        results.push(...batchResults);
      }

      return results;
    },
    [client]
  );
}

export function useBulkProvisionWorkforceAccountInvites() {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<
    WorkforceAccountBulkProvisionResultDto[],
    { items: Array<WorkforceAccountSubject & { accessProfileId: string }> }
  >(({ items }) =>
    client.post<WorkforceAccountBulkProvisionResultDto[]>(
      `${WORKFORCE_ACCOUNTS_PATH}/bulk-provision`,
      { items }
    ),
    {
      invalidateQueries: BULK_WORKFORCE_ACCOUNT_MUTATION_INVALIDATIONS,
    }
  );
}

export function useWorkforceAccountStatus(
  subject: WorkforceAccountSubject | null
) {
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    async (signal: AbortSignal) => {
      if (!subject?.employeeId) {
        throw new Error("Workforce account subject is required.");
      }

      const results = await client.post<WorkforceAccountStatusDto[]>(
        WORKFORCE_ACCOUNT_STATUSES_PATH,
        { subjects: [subject] },
        { signal }
      );

      return results[0] ?? null;
    },
    [client, subject]
  );

  return useApiQuery(
    subject?.employeeId
      ? employeeRosterQueryKeys.workforceAccount(subject.employeeId)
      : ([...employeeRosterQueryKeys.workforceAccounts(), "pending"] as const),
    queryFn,
    {
      enabled: !!subject?.employeeId,
    }
  );
}

export function useProvisionWorkforceAccountInvite() {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<
    WorkforceAccountStatusDto,
    {
      employeeId: string;
      email: string;
      firstName: string;
      lastName: string;
      accessProfileId: string;
    }
  >(({ employeeId, email, firstName, lastName, accessProfileId }) =>
    client.post<WorkforceAccountStatusDto>(
      `${WORKFORCE_ACCOUNTS_PATH}/${employeeId}/invite`,
      {
        email,
        firstName,
        lastName,
        accessProfileId,
      }
    ),
    {
      invalidateQueries: WORKFORCE_ACCOUNT_MUTATION_INVALIDATIONS,
    }
  );
}

export function useReactivateWorkforceAccount() {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<WorkforceAccountStatusDto, { employeeId: string }>(
    ({ employeeId }) =>
      client.post<WorkforceAccountStatusDto>(
        `${WORKFORCE_ACCOUNTS_PATH}/${employeeId}/reactivate`
      ),
    {
      invalidateQueries: WORKFORCE_ACCOUNT_MUTATION_INVALIDATIONS,
    }
  );
}

export function useResendWorkforceAccountInvite() {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<WorkforceAccountStatusDto, { employeeId: string }>(
    ({ employeeId }) =>
      client.post<WorkforceAccountStatusDto>(
        `${WORKFORCE_ACCOUNTS_PATH}/${employeeId}/resend`
      ),
    {
      invalidateQueries: WORKFORCE_ACCOUNT_MUTATION_INVALIDATIONS,
    }
  );
}

export function useDeactivateWorkforceAccount() {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<void, { employeeId: string }>(
    ({ employeeId }) =>
      client.delete<void>(`${WORKFORCE_ACCOUNTS_PATH}/${employeeId}`),
    {
      invalidateQueries: WORKFORCE_ACCOUNT_MUTATION_INVALIDATIONS,
    }
  );
}
