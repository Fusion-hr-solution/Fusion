"use client";

import { useCallback, useMemo } from "react";
import {
  corePeopleQueryKeys,
  createCorePeopleApi,
  createPlatformApiClient,
  type AddExistingEmployeeRequest,
  type HireEmployeeRequest,
  type EstablishmentReviewRequest,
  type PeopleQueryParams,
} from "@repo/api";
import {
  keepPreviousData,
  useApiMutation,
  useApiQuery,
} from "@repo/api/query";
import { useQueryClient } from "@tanstack/react-query";
import { canManageCoreEmployees, useAuth } from "@repo/auth";
import { canAccessEmployeeProfile, canAccessEmployeeRoster } from "@/lib/employee-roster-access";

function usePeopleApi() {
  const client = useMemo(() => createPlatformApiClient(), []);
  return useMemo(() => createCorePeopleApi(client), [client]);
}

export function usePeople(params: PeopleQueryParams) {
  const api = usePeopleApi();
  const { user, isAuthenticated, isLoading } = useAuth();
  const enabled = !isLoading && isAuthenticated && canAccessEmployeeRoster(user);
  return useApiQuery(
    corePeopleQueryKeys.list(params),
    useCallback((signal) => api.people(params, signal), [api, params]),
    { enabled, placeholderData: keepPreviousData }
  );
}

export function usePeopleProfile(employeeKey: string) {
  const api = usePeopleApi();
  const { user, isAuthenticated, isLoading } = useAuth();
  const enabled = !isLoading && isAuthenticated && canAccessEmployeeProfile(user) && Boolean(employeeKey);
  return useApiQuery(
    corePeopleQueryKeys.profile(employeeKey),
    useCallback((signal) => api.profile(employeeKey, signal), [api, employeeKey]),
    { enabled }
  );
}

export function usePeopleAccessStatus(employeeKey: string, enabled = true) {
  const api = usePeopleApi();
  const { user, isAuthenticated, isLoading } = useAuth();
  const canRead = !isLoading && isAuthenticated && canAccessEmployeeProfile(user) && Boolean(employeeKey) && enabled;
  return useApiQuery(
    corePeopleQueryKeys.accessStatus(employeeKey),
    useCallback((signal) => api.accessStatus(employeeKey, signal), [api, employeeKey]),
    { enabled: canRead }
  );
}

export function useManagerOptions(effectiveDate: string, q: string) {
  const api = usePeopleApi();
  const { user, isAuthenticated, isLoading } = useAuth();
  const enabled = !isLoading && isAuthenticated && canManageCoreEmployees(user) && Boolean(effectiveDate);
  return useApiQuery(
    corePeopleQueryKeys.managerOptions(effectiveDate, q),
    useCallback((signal) => api.managerOptions(effectiveDate, q, signal), [api, effectiveDate, q]),
    { enabled, placeholderData: keepPreviousData }
  );
}

export function usePeopleEstablishmentMutations() {
  const api = usePeopleApi();
  const queryClient = useQueryClient();
  const refreshCommittedPeople = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: corePeopleQueryKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: corePeopleQueryKeys.profiles() });
  }, [queryClient]);
  return {
    review: useApiMutation((request: EstablishmentReviewRequest) =>
      api.establishmentReview(request)),
    hire: useApiMutation((request: HireEmployeeRequest) => api.hire(request), {
      onSuccess: refreshCommittedPeople,
    }),
    addExisting: useApiMutation(
      (request: AddExistingEmployeeRequest) => api.addExisting(request),
      { onSuccess: refreshCommittedPeople }
    ),
  };
}
