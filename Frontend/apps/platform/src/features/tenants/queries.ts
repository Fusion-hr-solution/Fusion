"use client";

import {
  keepPreviousData,
  useApiMutation,
  useApiQuery,
  useApiQueryClient,
} from "@repo/api/query";
import type { RecoveryAction } from "./api";
import {
  ACTIVITY_PREVIEW_LIMIT,
  getTenant,
  listProvisionableModules,
  listRecentActivity,
  listTenants,
  provisionTenant,
  reissueInvitation,
  replaceInvitation,
  resendInvitation,
  revokeInvitation,
  type ProvisionTenantInput,
  type TenantOverviewQuery,
} from "./api";

export const tenantKeys = {
  all: ["platform", "tenants"] as const,
  list: (query: TenantOverviewQuery) =>
    ["platform", "tenants", "list", query] as const,
  detail: (tenantId: string) =>
    ["platform", "tenants", "detail", tenantId] as const,
  activity: (limit: number) =>
    ["platform", "tenants", "activity", limit] as const,
  moduleCatalogue: ["platform", "tenants", "module-catalogue"] as const,
};

export function useTenantOverview(query: TenantOverviewQuery) {
  return useApiQuery(
    tenantKeys.list(query),
    (signal) => listTenants(query, signal),
    {
      // Changing a filter keeps the current rows in place while the next set
      // loads, so the list does not collapse into a skeleton on every keystroke.
      placeholderData: keepPreviousData,
    }
  );
}

/**
 * What provisioning accepts. It changes only with a deployment, so it is cached
 * for the session rather than refetched alongside the form.
 */
export function useProvisionableModules() {
  return useApiQuery(
    tenantKeys.moduleCatalogue,
    (signal) => listProvisionableModules(signal),
    { staleTime: Infinity }
  );
}

export function useTenantActivity(limit: number = ACTIVITY_PREVIEW_LIMIT) {
  return useApiQuery(tenantKeys.activity(limit), (signal) =>
    listRecentActivity(limit, signal)
  );
}

export function useTenantDetail(tenantId: string) {
  return useApiQuery(
    tenantKeys.detail(tenantId),
    (signal) => getTenant(tenantId, signal),
    // The detail is the authoritative record a recovery action is judged
    // against, so it is never served from cache without revalidating.
    { staleTime: 0 }
  );
}

export function useProvisionTenant(
  onProvisioned: (tenantId: string) => void
) {
  return useApiMutation(
    (input: ProvisionTenantInput) => provisionTenant(input),
    {
      onSuccess: (result) => onProvisioned(result.tenantId),
      invalidateQueries: [{ queryKey: tenantKeys.all }],
    }
  );
}

interface RecoveryArgs {
  tenantId: string;
  invitationId: string;
  email?: string;
}

/**
 * Every recovery outcome — including a stale-state conflict — settles by
 * refetching the tenant detail, so the page always ends on the authoritative
 * state rather than on what the operator expected to happen.
 */
export function useInvitationRecovery(action: RecoveryAction) {
  const queryClient = useApiQueryClient();

  return useApiMutation(
    (args: RecoveryArgs) => {
      switch (action) {
        case "resend":
          return resendInvitation(args.tenantId, args.invitationId);
        case "revoke":
          return revokeInvitation(args.tenantId, args.invitationId);
        case "replace":
          return replaceInvitation(
            args.tenantId,
            args.invitationId,
            args.email ?? ""
          );
        case "reissue":
          return reissueInvitation(args.tenantId, args.invitationId);
      }
    },
    {
      // `tenantKeys.all` is a prefix of `detail`, so it covers the record too.
      invalidateQueries: () => [{ queryKey: tenantKeys.all }],
      // A refused command is exactly when the operator's picture of the
      // invitation is most likely to be out of date, so the failure path
      // refreshes the record too.
      onError: (_error, args) => {
        void queryClient.invalidateQueries({
          queryKey: tenantKeys.detail(args.tenantId),
        });
      },
    }
  );
}
