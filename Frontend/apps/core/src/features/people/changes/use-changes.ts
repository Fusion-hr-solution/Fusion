"use client";

import { useCallback, useMemo } from "react";
import {
  coreOrgChartQueryKeys,
  corePeopleQueryKeys,
  createCorePeopleApi,
  createPlatformApiClient,
  type DottedLineRequestBody,
  type EditChangeRequest,
  type EndEmploymentChangeRequest,
  type JobChangeRequest,
  type JoinChangeRequest,
} from "@repo/api";
import { keepPreviousData, useApiMutation, useApiQuery } from "@repo/api/query";
import { useQueryClient } from "@tanstack/react-query";
import {
  canAccessCorePeople,
  canAccessCoreTeam,
  canManageCoreEmployees,
  canManageCoreReporting,
  useAuth,
} from "@repo/auth";

function usePeopleApi() {
  const client = useMemo(() => createPlatformApiClient(), []);
  return useMemo(() => createCorePeopleApi(client), [client]);
}

/** Who may do what with people changes; the server checks the same rules. */
export function useChangeRights() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const ready = !isLoading && isAuthenticated;
  const people = ready && canManageCoreEmployees(user);
  const reporting = ready && canManageCoreReporting(user);
  return {
    /** Any change: job, end, start. */
    people,
    /** Manager and team only (reporting admins), or anything (people admins). */
    lines: people || reporting,
    /** Coming changes: the tenant for People viewers, the branch for managers. */
    seeComing: ready && (canAccessCorePeople(user) || canAccessCoreTeam(user)),
  };
}

/** Every change made here refreshes what shows people: profiles, lists, the chart and coming changes. */
function useRefresh() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: corePeopleQueryKeys.all() });
    void queryClient.invalidateQueries({ queryKey: coreOrgChartQueryKeys.all() });
  }, [queryClient]);
}

export function useChangeMutations(employeeKey: string) {
  const api = usePeopleApi();
  const onSuccess = useRefresh();
  return {
    changeJob: useApiMutation((request: JobChangeRequest) => api.changeJob(employeeKey, request), { onSuccess }),
    endEmployment: useApiMutation((request: EndEmploymentChangeRequest) => api.endEmployment(employeeKey, request), { onSuccess }),
    startEmployment: useApiMutation((request: JoinChangeRequest) => api.startEmployment(employeeKey, request), { onSuccess }),
    editChange: useApiMutation(({ id, request }: { id: string; request: EditChangeRequest }) => api.editChange(id, request), { onSuccess }),
    dottedLine: useApiMutation(
      ({ end, ...request }: DottedLineRequestBody & { end: boolean }) => api.dottedLine(employeeKey, request, end),
      { onSuccess },
    ),
  };
}

export function useCancelChange() {
  const api = usePeopleApi();
  const onSuccess = useRefresh();
  return useApiMutation((changeId: string) => api.cancelChange(changeId), { onSuccess });
}

export function useUpcomingChanges(enabled = true) {
  const api = usePeopleApi();
  const { seeComing } = useChangeRights();
  return useApiQuery(
    corePeopleQueryKeys.upcomingChanges(),
    useCallback((signal) => api.upcomingChanges(signal), [api]),
    { enabled: enabled && seeComing },
  );
}

export function useEndEmploymentPreview(employeeKey: string, lastDay: string, enabled = true) {
  const api = usePeopleApi();
  const { people } = useChangeRights();
  return useApiQuery(
    corePeopleQueryKeys.endEmploymentPreview(employeeKey, lastDay),
    useCallback((signal) => api.endEmploymentPreview(employeeKey, lastDay, signal), [api, employeeKey, lastDay]),
    { enabled: enabled && people && Boolean(employeeKey && lastDay), placeholderData: keepPreviousData },
  );
}

/** What the new line does in Performance; quietly absent when Performance can't say. */
export function useLineEffects(employeeId: string | null, managerId: string | null, enabled = true) {
  const api = usePeopleApi();
  const { lines } = useChangeRights();
  return useApiQuery(
    corePeopleQueryKeys.lineEffects(employeeId ?? "", managerId),
    useCallback((signal) => api.lineEffects(employeeId ?? "", managerId, signal), [api, employeeId, managerId]),
    { enabled: enabled && lines && Boolean(employeeId), retry: false },
  );
}

/** People someone can report to on a date; with `forEmployee`, not them, their branch or their manager. */
export function useManagerOptions(effectiveDate: string, q: string, forEmployee?: string | null) {
  const api = usePeopleApi();
  const { lines } = useChangeRights();
  return useApiQuery(
    corePeopleQueryKeys.managerOptions(effectiveDate, q, forEmployee),
    useCallback((signal) => api.managerOptions(effectiveDate, q, signal, forEmployee), [api, effectiveDate, q, forEmployee]),
    { enabled: lines && Boolean(effectiveDate), placeholderData: keepPreviousData },
  );
}
