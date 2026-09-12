"use client";

import { useCallback, useMemo } from "react";
import {
  ApiError,
  createPlatformApiClient,
  tenantAccessPaths,
  tenantAccessQueryKeys,
  type AccessActivityItemDto,
  type AdministratorInvitationDto,
  type InvitationCommandResponse,
  type RemovedAdministratorDto,
  type TenantAccessProblemType,
  type TenantAccessSummaryDto,
  type TenantAdministratorDto,
} from "@repo/api";
import { useApiMutation, useApiQuery, useApiQueryClient } from "@repo/api/query";
import { useAuth } from "@repo/auth";

type ApiQueryClient = ReturnType<typeof useApiQueryClient>;

/**
 * Every sensitive mutation refreshes the summary, the affected list, and
 * activity together, so the workspace never shows a count that disagrees with
 * the rows beneath it.
 */
async function refreshAccessWorkspace(queryClient: ApiQueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: tenantAccessQueryKeys.summary() }),
    queryClient.invalidateQueries({ queryKey: tenantAccessQueryKeys.administrators() }),
    queryClient.invalidateQueries({ queryKey: tenantAccessQueryKeys.all() }),
  ]);
}

/**
 * Reloads the workspace from the server outside the success path.
 *
 * A refused command can still mean the screen is wrong — a stale-state conflict
 * says so explicitly — and mutation success hooks never run for those. Without
 * this, a stale panel keeps the version it was rendered from and every retry
 * fails the same way.
 */
export function useRefreshAccessWorkspace() {
  const queryClient = useApiQueryClient();
  return useCallback(() => refreshAccessWorkspace(queryClient), [queryClient]);
}

/**
 * The stable problem type behind a failure, so each one can be resolved the way
 * it actually needs to be. Falls back to `unexpected` rather than guessing from
 * message text.
 */
export function problemTypeOf(error: unknown): TenantAccessProblemType {
  if (!(error instanceof ApiError)) {
    return "unexpected";
  }

  // The envelope carries the machine-readable type under `details.code`; the
  // client only lifts a root-level `code` into ApiError.code. Reading both is
  // what makes the difference between showing the specific, actionable message
  // the experience requires and falling back to a generic failure — which is
  // the same thing as having no problem types at all.
  const details = error.details as { code?: unknown } | null;
  const code = typeof details?.code === "string" ? details.code : error.code;

  return (code as TenantAccessProblemType | null) ?? "unexpected";
}

// ── Reads ──────────────────────────────────────────────

export function useTenantAccessSummary(enabled = true) {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<TenantAccessSummaryDto>(tenantAccessPaths.summary(), { signal }),
    [client]
  );

  return useApiQuery(tenantAccessQueryKeys.summary(), queryFn, {
    enabled: isAuthenticated && enabled,
  });
}

export function useTenantAdministrators(enabled = true) {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<TenantAdministratorDto[]>(tenantAccessPaths.administrators(), { signal }),
    [client]
  );

  return useApiQuery(tenantAccessQueryKeys.administrators(), queryFn, {
    enabled: isAuthenticated && enabled,
  });
}

export function useRemovedAdministrators(enabled = true) {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<RemovedAdministratorDto[]>(tenantAccessPaths.removedAdministrators(), { signal }),
    [client]
  );

  return useApiQuery(tenantAccessQueryKeys.removedAdministrators(), queryFn, {
    enabled: isAuthenticated && enabled,
  });
}

export function useAdministratorInvitations(includeHistorical = false, enabled = true) {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<AdministratorInvitationDto[]>(tenantAccessPaths.invitations(), {
        signal,
        params: { includeHistorical },
      }),
    [client, includeHistorical]
  );

  return useApiQuery(tenantAccessQueryKeys.invitations(includeHistorical), queryFn, {
    enabled: isAuthenticated && enabled,
  });
}

export function useRecentAccessActivity(enabled = true) {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<AccessActivityItemDto[]>(tenantAccessPaths.recentActivity(), { signal }),
    [client]
  );

  return useApiQuery(tenantAccessQueryKeys.recentActivity(), queryFn, {
    enabled: isAuthenticated && enabled,
  });
}

// ── Invitations ────────────────────────────────────────

export interface InviteAdministratorInput {
  email: string;
  firstName: string;
  lastName: string;
}

export function useInviteAdministrator() {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<InvitationCommandResponse, InviteAdministratorInput>(
    ({ email, firstName, lastName }) =>
      client.post<InvitationCommandResponse>(tenantAccessPaths.invitations(), {
        email,
        firstName,
        lastName,
      }),
    { onSuccess: () => refreshAccessWorkspace(queryClient) }
  );
}

export function useResendInvitation() {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<InvitationCommandResponse, string>(
    (invitationId) =>
      client.post<InvitationCommandResponse>(tenantAccessPaths.resendInvitation(invitationId)),
    { onSuccess: () => refreshAccessWorkspace(queryClient) }
  );
}

export function useReplaceInvitationEmail() {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<InvitationCommandResponse, { invitationId: string; email: string }>(
    ({ invitationId, email }) =>
      client.post<InvitationCommandResponse>(
        tenantAccessPaths.replaceInvitationEmail(invitationId),
        { email }
      ),
    { onSuccess: () => refreshAccessWorkspace(queryClient) }
  );
}

export function useRevokeInvitation() {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<InvitationCommandResponse, string>(
    (invitationId) =>
      client.post<InvitationCommandResponse>(tenantAccessPaths.revokeInvitation(invitationId)),
    { onSuccess: () => refreshAccessWorkspace(queryClient) }
  );
}

// ── Administrator lifecycle ────────────────────────────

interface AdministratorMutationArgs {
  membershipId: string;
  /** The state the drawer was rendered from, so a stale click is refused. */
  version: number;
  reason?: string;
}

function ifMatch(version: number) {
  return { headers: { "If-Match": `"${version}"` } };
}

export function useSuspendAdministrator() {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<unknown, AdministratorMutationArgs>(
    ({ membershipId, version, reason }) =>
      client.post(tenantAccessPaths.suspend(membershipId), { reason }, ifMatch(version)),
    { onSuccess: () => refreshAccessWorkspace(queryClient) }
  );
}

export function useReactivateAdministrator() {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<unknown, AdministratorMutationArgs>(
    ({ membershipId, version }) =>
      client.post(tenantAccessPaths.reactivate(membershipId), undefined, ifMatch(version)),
    { onSuccess: () => refreshAccessWorkspace(queryClient) }
  );
}

/** Covers self-removal: the actor names their own membership. */
export function useRevokeAdministratorAuthority() {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<unknown, AdministratorMutationArgs>(
    ({ membershipId, version, reason }) =>
      client.post(tenantAccessPaths.revokeAuthority(membershipId), { reason }, ifMatch(version)),
    { onSuccess: () => refreshAccessWorkspace(queryClient) }
  );
}
