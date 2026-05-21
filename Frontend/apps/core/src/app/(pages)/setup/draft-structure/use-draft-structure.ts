"use client";

import { useCallback, useMemo } from "react";
import {
  coreWorkforceQueryKeys,
  createPlatformApiClient,
  coreSetupQueryKeys,
  tenantSettingsQueryKeys,
  draftStructureQueryKeys,
  draftStructurePaths,
  type CreateDraftOrgUnitRequest,
  type DraftOrgUnitTreeNodeDto,
  type DraftStructureImportApplyResultDto,
  type DraftStructureImportMappingRequest,
  type DraftStructureImportResolveKindsRequest,
  type DraftStructureImportSchemaDto,
  type DraftStructureImportSessionDto,
  type DraftOrgUnitDto,
  type DraftStructureWorkspaceDto,
  type UpdateDraftOrgUnitRequest,
} from "@repo/api";
import {
  useApiMutation,
  useApiQuery,
  useApiQueryClient,
} from "@repo/api/query";
import { useAuth } from "@repo/auth";

interface UpdateDraftOrgUnitArgs {
  id: string;
  version: number;
  input: UpdateDraftOrgUnitRequest;
}

interface DeleteDraftOrgUnitArgs {
  id: string;
  version: number;
  replacementParentId?: string;
  promoteChildrenToRoot?: boolean;
}

async function invalidateDraftStructureLifecycleQueries(
  queryClient: ReturnType<typeof useApiQueryClient>,
  options?: { includePublishedSurfaces?: boolean }
) {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: draftStructureQueryKeys.all() }),
    queryClient.invalidateQueries({ queryKey: coreSetupQueryKeys.all() }),
  ];

  if (options?.includePublishedSurfaces) {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: tenantSettingsQueryKeys.all(),
      }),
      queryClient.invalidateQueries({ queryKey: coreWorkforceQueryKeys.all() })
    );
  }

  await Promise.all(invalidations);
}

export function useDraftStructureWorkspace(enabled = true) {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<DraftStructureWorkspaceDto>(draftStructurePaths.workspace(), {
        signal,
      }),
    [client]
  );

  return useApiQuery(draftStructureQueryKeys.workspace(), queryFn, {
    enabled: isAuthenticated && enabled,
  });
}

export function useDraftStructureTree(enabled = true) {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<DraftOrgUnitTreeNodeDto[]>(draftStructurePaths.tree(), {
        signal,
      }),
    [client]
  );

  return useApiQuery(draftStructureQueryKeys.tree(), queryFn, {
    enabled: isAuthenticated && enabled,
  });
}

export function useCreateDraftOrgUnit(opts?: {
  onSuccess?: (data: DraftOrgUnitDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<DraftOrgUnitDto, CreateDraftOrgUnitRequest>(
    (input) =>
      client.post<DraftOrgUnitDto>(draftStructurePaths.create(), input),
    {
      onSuccess: async (data) => {
        await invalidateDraftStructureLifecycleQueries(queryClient);
        await opts?.onSuccess?.(data);
      },
    }
  );
}

export function useUpdateDraftOrgUnit(opts?: {
  onSuccess?: (data: DraftOrgUnitDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<DraftOrgUnitDto, UpdateDraftOrgUnitArgs>(
    ({ id, version, input }) =>
      client.put<DraftOrgUnitDto>(draftStructurePaths.update(id), input, {
        headers: { "If-Match": `"${version}"` },
      }),
    {
      onSuccess: async (data) => {
        await invalidateDraftStructureLifecycleQueries(queryClient);
        await opts?.onSuccess?.(data);
      },
    }
  );
}

export function useDeleteDraftOrgUnit(opts?: { onSuccess?: () => void }) {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<void, DeleteDraftOrgUnitArgs>(
    ({ id, version, replacementParentId, promoteChildrenToRoot }) =>
      client.delete<void>(draftStructurePaths.remove(id), {
        headers: { "If-Match": `"${version}"` },
        params: {
          replacementParentId,
          promoteChildrenToRoot,
        },
      }),
    {
      onSuccess: async () => {
        await invalidateDraftStructureLifecycleQueries(queryClient);
        await opts?.onSuccess?.();
      },
    }
  );
}

export function useDraftStructureImportSchema(enabled = true) {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<DraftStructureImportSchemaDto>(
        draftStructurePaths.importSchema(),
        {
          signal,
        }
      ),
    [client]
  );

  return useApiQuery(draftStructureQueryKeys.importSchema(), queryFn, {
    enabled: isAuthenticated && enabled,
  });
}

export function useDraftStructureImportSession(
  sessionId: string | null,
  enabled = true
) {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) => {
      if (!sessionId) {
        throw new Error("An import session id is required.");
      }

      return client.get<DraftStructureImportSessionDto>(
        draftStructurePaths.importSession(sessionId),
        {
          signal,
        }
      );
    },
    [client, sessionId]
  );

  return useApiQuery(
    draftStructureQueryKeys.importSession(sessionId ?? "pending"),
    queryFn,
    {
      enabled: isAuthenticated && enabled && !!sessionId,
    }
  );
}

export function useUploadDraftStructureImport(opts?: {
  onSuccess?: (data: DraftStructureImportSessionDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<DraftStructureImportSessionDto, File>(
    async (file) => {
      const formData = new FormData();
      formData.append("file", file);

      return client.post<DraftStructureImportSessionDto>(
        draftStructurePaths.importUpload(),
        formData
      );
    },
    {
      onSuccess: async (data) => {
        queryClient.setQueryData(
          draftStructureQueryKeys.importSession(data.id),
          data
        );
        await opts?.onSuccess?.(data);
      },
    }
  );
}

export function useDownloadDraftStructureTemplate(opts?: {
  onSuccess?: (blob: Blob) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<Blob, undefined>(
    () =>
      client.get<Blob>(draftStructurePaths.importTemplate(), {
        responseType: "blob",
      }),
    {
      onSuccess: async (blob) => {
        await opts?.onSuccess?.(blob);
      },
    }
  );
}

export function useSaveDraftStructureImportMapping(opts?: {
  onSuccess?: (data: DraftStructureImportSessionDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<
    DraftStructureImportSessionDto,
    { sessionId: string; input: DraftStructureImportMappingRequest }
  >(
    ({ sessionId, input }) =>
      client.put<DraftStructureImportSessionDto>(
        draftStructurePaths.importMapping(sessionId),
        input
      ),
    {
      onSuccess: async (data) => {
        queryClient.setQueryData(
          draftStructureQueryKeys.importSession(data.id),
          data
        );
        await opts?.onSuccess?.(data);
      },
    }
  );
}

export function useResolveDraftStructureImportKinds(opts?: {
  onSuccess?: (data: DraftStructureImportSessionDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<
    DraftStructureImportSessionDto,
    { sessionId: string; input: DraftStructureImportResolveKindsRequest }
  >(
    ({ sessionId, input }) =>
      client.put<DraftStructureImportSessionDto>(
        draftStructurePaths.importKinds(sessionId),
        input
      ),
    {
      onSuccess: async (data) => {
        queryClient.setQueryData(
          draftStructureQueryKeys.importSession(data.id),
          data
        );
        await opts?.onSuccess?.(data);
      },
    }
  );
}

export function useValidateDraftStructureImport(opts?: {
  onSuccess?: (data: DraftStructureImportSessionDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<DraftStructureImportSessionDto, { sessionId: string }>(
    ({ sessionId }) =>
      client.post<DraftStructureImportSessionDto>(
        draftStructurePaths.importValidate(sessionId)
      ),
    {
      onSuccess: async (data) => {
        queryClient.setQueryData(
          draftStructureQueryKeys.importSession(data.id),
          data
        );
        await opts?.onSuccess?.(data);
      },
    }
  );
}

export function useApplyDraftStructureImport(opts?: {
  onSuccess?: (data: DraftStructureImportApplyResultDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<
    DraftStructureImportApplyResultDto,
    { sessionId: string }
  >(
    ({ sessionId }) =>
      client.post<DraftStructureImportApplyResultDto>(
        draftStructurePaths.importApply(sessionId)
      ),
    {
      onSuccess: async (data) => {
        queryClient.removeQueries({
          queryKey: draftStructureQueryKeys.importSessions(),
        });
        await invalidateDraftStructureLifecycleQueries(queryClient);
        await opts?.onSuccess?.(data);
      },
    }
  );
}
