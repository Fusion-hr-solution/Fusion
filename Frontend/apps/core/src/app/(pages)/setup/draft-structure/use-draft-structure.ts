"use client";

import { useCallback, useMemo } from "react";
import {
  createPlatformApiClient,
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
import { useApiMutation, useApiQuery } from "@repo/api/react";
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

  return useApiQuery(queryFn, { enabled: isAuthenticated && enabled });
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

  return useApiQuery(queryFn, { enabled: isAuthenticated && enabled });
}

export function useCreateDraftOrgUnit(opts?: {
  onSuccess?: (data: DraftOrgUnitDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<DraftOrgUnitDto, CreateDraftOrgUnitRequest>(
    (input) => client.post<DraftOrgUnitDto>(draftStructurePaths.create(), input),
    opts
  );
}

export function useUpdateDraftOrgUnit(opts?: {
  onSuccess?: (data: DraftOrgUnitDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<DraftOrgUnitDto, UpdateDraftOrgUnitArgs>(
    ({ id, version, input }) =>
      client.put<DraftOrgUnitDto>(draftStructurePaths.update(id), input, {
        headers: { "If-Match": `"${version}"` },
      }),
    opts
  );
}

export function useDeleteDraftOrgUnit(opts?: { onSuccess?: () => void }) {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<void, DeleteDraftOrgUnitArgs>(
    ({ id, version, replacementParentId, promoteChildrenToRoot }) =>
      client.delete<void>(draftStructurePaths.remove(id), {
        headers: { "If-Match": `"${version}"` },
        params: {
          replacementParentId,
          promoteChildrenToRoot,
        },
      }),
    opts
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

  return useApiQuery(queryFn, { enabled: isAuthenticated && enabled });
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

  return useApiQuery(queryFn, {
    enabled: isAuthenticated && enabled && !!sessionId,
  });
}

export function useUploadDraftStructureImport(opts?: {
  onSuccess?: (data: DraftStructureImportSessionDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<DraftStructureImportSessionDto, File>(
    async (file) => {
      const formData = new FormData();
      formData.append("file", file);

      return client.post<DraftStructureImportSessionDto>(
        draftStructurePaths.importUpload(),
        formData
      );
    },
    opts
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
    opts
  );
}

export function useSaveDraftStructureImportMapping(opts?: {
  onSuccess?: (data: DraftStructureImportSessionDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<
    DraftStructureImportSessionDto,
    { sessionId: string; input: DraftStructureImportMappingRequest }
  >(
    ({ sessionId, input }) =>
      client.put<DraftStructureImportSessionDto>(
        draftStructurePaths.importMapping(sessionId),
        input
      ),
    opts
  );
}

export function useResolveDraftStructureImportKinds(opts?: {
  onSuccess?: (data: DraftStructureImportSessionDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<
    DraftStructureImportSessionDto,
    { sessionId: string; input: DraftStructureImportResolveKindsRequest }
  >(
    ({ sessionId, input }) =>
      client.put<DraftStructureImportSessionDto>(
        draftStructurePaths.importKinds(sessionId),
        input
      ),
    opts
  );
}

export function useValidateDraftStructureImport(opts?: {
  onSuccess?: (data: DraftStructureImportSessionDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<DraftStructureImportSessionDto, { sessionId: string }>(
    ({ sessionId }) =>
      client.post<DraftStructureImportSessionDto>(
        draftStructurePaths.importValidate(sessionId)
      ),
    opts
  );
}

export function useApplyDraftStructureImport(opts?: {
  onSuccess?: (data: DraftStructureImportApplyResultDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<
    DraftStructureImportApplyResultDto,
    { sessionId: string }
  >(
    ({ sessionId }) =>
      client.post<DraftStructureImportApplyResultDto>(
        draftStructurePaths.importApply(sessionId)
      ),
    opts
  );
}