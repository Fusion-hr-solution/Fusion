"use client";

import { useCallback, useMemo } from "react";
import {
  coreAccessPaths,
  coreAccessQueryKeys,
  createPlatformApiClient,
  type AccessProfileSummaryDto,
  type CorePermissionCatalogItemDto,
  type CreateAccessProfileRequest,
  type SetUserAccessProfilesRequest,
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

interface SetUserAccessProfilesArgs {
  userId: string;
  input: SetUserAccessProfilesRequest;
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

export function useCreateAccessProfile(opts?: {
  onSuccess?: (data: AccessProfileSummaryDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<AccessProfileSummaryDto, CreateAccessProfileRequest>(
    (input) => client.post<AccessProfileSummaryDto>(coreAccessPaths.profiles(), input),
    {
      onSuccess: async (data) => {
        await queryClient.invalidateQueries({ queryKey: coreAccessQueryKeys.profiles() });
        await queryClient.invalidateQueries({ queryKey: coreAccessQueryKeys.assignments() });
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
      client.put<AccessProfileSummaryDto>(coreAccessPaths.profile(profileId), input, {
        headers: { "If-Match": `"${expectedVersion}"` },
      }),
    {
      onSuccess: async (data) => {
        await queryClient.invalidateQueries({ queryKey: coreAccessQueryKeys.profiles() });
        await queryClient.invalidateQueries({ queryKey: coreAccessQueryKeys.assignments() });
        await opts?.onSuccess?.(data);
      },
    }
  );
}

export function useDeleteAccessProfile(opts?: {
  onSuccess?: () => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<void, DeleteAccessProfileArgs>(
    ({ profileId }) => client.delete<void>(coreAccessPaths.profile(profileId)),
    {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: coreAccessQueryKeys.profiles() });
        await queryClient.invalidateQueries({ queryKey: coreAccessQueryKeys.assignments() });
        await opts?.onSuccess?.();
      },
    }
  );
}

export function useSetUserAccessProfiles(opts?: {
  onSuccess?: (data: UserAccessAssignmentDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<UserAccessAssignmentDto, SetUserAccessProfilesArgs>(
    ({ userId, input }) =>
      client.put<UserAccessAssignmentDto>(coreAccessPaths.assignment(userId), input),
    {
      onSuccess: async (data) => {
        queryClient.setQueriesData(
          { queryKey: coreAccessQueryKeys.assignments() },
          (current: UserAccessAssignmentDto[] | undefined) =>
            current?.map((row) => (row.userId === data.userId ? data : row)) ?? current
        );
        await queryClient.invalidateQueries({ queryKey: coreAccessQueryKeys.assignments() });
        await queryClient.invalidateQueries({ queryKey: coreAccessQueryKeys.profiles() });
        await opts?.onSuccess?.(data);
      },
    }
  );
}
