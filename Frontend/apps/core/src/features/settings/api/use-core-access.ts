"use client";

import { useCallback, useMemo } from "react";
import {
  coreAccessPaths,
  coreAccessQueryKeys,
  createPlatformApiClient,
  type AccessAuditEventDto,
  type AccessProfileSummaryDto,
  type CorePermissionCatalogItemDto,
  type CreateAccessProfileRequest,
  type UpdateAccessProfileRequest,
  type UserAccessAssignmentDto,
} from "@repo/api";
import {
  useApiMutation,
  useApiQuery,
  useApiQueryClient,
} from "@repo/api/query";
import { useAuth } from "@repo/auth";

interface UpdateAccessProfileArgs {
  profileId: string;
  expectedVersion: number;
  input: UpdateAccessProfileRequest;
}

interface DeleteAccessProfileArgs {
  profileId: string;
}

type ApiQueryClient = ReturnType<typeof useApiQueryClient>;

async function invalidateAccessProfileQueries(queryClient: ApiQueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: coreAccessQueryKeys.profiles(),
    }),
    queryClient.invalidateQueries({
      queryKey: coreAccessQueryKeys.assignments(),
    }),
    queryClient.invalidateQueries({
      queryKey: coreAccessQueryKeys.audit(),
    }),
  ]);
}

export function useCorePermissionCatalog(enabled = true) {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<CorePermissionCatalogItemDto[]>(coreAccessPaths.catalog(), {
        signal,
      }),
    [client]
  );

  return useApiQuery(coreAccessQueryKeys.catalog(), queryFn, {
    enabled: isAuthenticated && enabled,
  });
}

export function useAccessProfiles(enabled = true) {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<AccessProfileSummaryDto[]>(coreAccessPaths.profiles(), {
        signal,
      }),
    [client]
  );

  return useApiQuery(coreAccessQueryKeys.profiles(), queryFn, {
    enabled: isAuthenticated && enabled,
  });
}

export function useUserAccessAssignments(enabled = true) {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<UserAccessAssignmentDto[]>(coreAccessPaths.assignments(), {
        signal,
      }),
    [client]
  );

  return useApiQuery(coreAccessQueryKeys.assignments(), queryFn, {
    enabled: isAuthenticated && enabled,
  });
}

export function useAccessAudit(enabled = true) {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<AccessAuditEventDto[]>(coreAccessPaths.audit(), {
        signal,
      }),
    [client]
  );

  return useApiQuery(coreAccessQueryKeys.audit(), queryFn, {
    enabled: isAuthenticated && enabled,
  });
}

export function useCreateAccessProfile(opts?: {
  onSuccess?: (data: AccessProfileSummaryDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<AccessProfileSummaryDto, CreateAccessProfileRequest>(
    (input) =>
      client.post<AccessProfileSummaryDto>(coreAccessPaths.profiles(), input),
    {
      onSuccess: async (data) => {
        await invalidateAccessProfileQueries(queryClient);
        await opts?.onSuccess?.(data);
      },
    }
  );
}

export function useUpdateAccessProfile(opts?: {
  onSuccess?: (data: AccessProfileSummaryDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<AccessProfileSummaryDto, UpdateAccessProfileArgs>(
    ({ profileId, expectedVersion, input }) =>
      client.put<AccessProfileSummaryDto>(
        coreAccessPaths.profile(profileId),
        input,
        {
          headers: { "If-Match": `"${expectedVersion}"` },
        }
      ),
    {
      onSuccess: async (data) => {
        await invalidateAccessProfileQueries(queryClient);
        await opts?.onSuccess?.(data);
      },
    }
  );
}

export function useDeleteAccessProfile(opts?: { onSuccess?: () => void }) {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<void, DeleteAccessProfileArgs>(
    ({ profileId }) => client.delete<void>(coreAccessPaths.profile(profileId)),
    {
      onSuccess: async () => {
        await invalidateAccessProfileQueries(queryClient);
        await opts?.onSuccess?.();
      },
    }
  );
}
