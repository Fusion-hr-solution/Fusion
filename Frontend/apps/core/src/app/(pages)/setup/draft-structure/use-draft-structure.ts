"use client";

import { useCallback, useMemo } from "react";
import {
  createPlatformApiClient,
  draftStructurePaths,
  type CreateDraftOrgUnitRequest,
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