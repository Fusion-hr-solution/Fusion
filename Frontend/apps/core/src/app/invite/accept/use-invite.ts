"use client";

import { useCallback, useMemo } from "react";
import {
  createPlatformApiClient,
  invitePaths,
  type InviteDto,
  type AcceptInviteRequest,
} from "@repo/api";
import { useApiQuery, type UseApiQueryResult } from "@repo/api/react";
import { useApiMutation, type UseApiMutationResult } from "@repo/api/react";

// ---------------------------------------------------------------------------
// Validate invite token (anonymous GET)
// ---------------------------------------------------------------------------

export function useValidateInvite(
  token: string | null
): UseApiQueryResult<InviteDto> {
  const client = useMemo(
    () => createPlatformApiClient({ getToken: () => null }),
    []
  );

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<InviteDto>(invitePaths.validate(token!), {
        signal,
        skipAuth: true,
      }),
    [client, token]
  );

  return useApiQuery(queryFn, { enabled: !!token });
}

// ---------------------------------------------------------------------------
// Accept invite (anonymous POST — creates user account)
// ---------------------------------------------------------------------------

export interface AcceptInvitePayload {
  token: string;
  request: AcceptInviteRequest;
}

interface AcceptInviteResponse {
  id: string;
  email: string;
  fullName: string;
  tenantId: string;
  roles: string[];
}

export function useAcceptInvite(opts?: {
  onSuccess?: (data: AcceptInviteResponse) => void;
}): UseApiMutationResult<AcceptInviteResponse, AcceptInvitePayload> {
  const client = useMemo(
    () => createPlatformApiClient({ getToken: () => null }),
    []
  );

  return useApiMutation<AcceptInviteResponse, AcceptInvitePayload>(
    (args) =>
      client.post<AcceptInviteResponse>(
        invitePaths.accept(args.token),
        args.request,
        { skipAuth: true }
      ),
    opts
  );
}
