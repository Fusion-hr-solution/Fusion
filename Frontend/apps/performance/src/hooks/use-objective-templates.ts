"use client";

import { useCallback, useMemo } from "react";
import {
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
} from "@repo/api";
import type {
  CreateObjectiveTemplateRequest,
  ObjectiveTemplateDto,
  PerformancePageDto,
  UpdateObjectiveTemplateRequest,
} from "@repo/api";
import {
  keepPreviousData,
  useApiMutation,
  useApiQuery,
  type UseApiQueryResult,
} from "@repo/api/query";
import { useAuth } from "@repo/auth";

interface TemplateListParams {
  search?: string | null;
  status?: string | null;
  category?: string | null;
  page: number;
  pageSize: number;
}

const ifMatch = (version: number) => ({ headers: { "If-Match": `"${version}"` } });

export function useObjectiveTemplates(
  params: TemplateListParams,
  enabled = true
): UseApiQueryResult<PerformancePageDto<ObjectiveTemplateDto>> {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<PerformancePageDto<ObjectiveTemplateDto>>(
        performancePaths.objectiveTemplates(),
        {
          signal,
          params: {
            search: params.search?.trim() || undefined,
            status: params.status || undefined,
            category: params.category || undefined,
            page: params.page,
            pageSize: params.pageSize,
          },
        }
      ),
    [client, params.search, params.status, params.category, params.page, params.pageSize]
  );

  return useApiQuery(performanceQueryKeys.objectiveTemplateList(params), queryFn, {
    enabled: isAuthenticated && enabled,
    placeholderData: keepPreviousData,
  });
}

export function useCreateObjectiveTemplate() {
  const client = useMemo(() => createPlatformApiClient(), []);
  return useApiMutation<ObjectiveTemplateDto, CreateObjectiveTemplateRequest>(
    (body) =>
      client.post<ObjectiveTemplateDto>(performancePaths.objectiveTemplates(), body),
    { invalidateQueries: [{ queryKey: performanceQueryKeys.objectiveTemplates() }] }
  );
}

export function useUpdateObjectiveTemplate(templateId: string) {
  const client = useMemo(() => createPlatformApiClient(), []);
  return useApiMutation<
    ObjectiveTemplateDto,
    { version: number; body: UpdateObjectiveTemplateRequest }
  >(
    ({ version, body }) =>
      client.put<ObjectiveTemplateDto>(
        performancePaths.objectiveTemplate(templateId),
        body,
        ifMatch(version)
      ),
    { invalidateQueries: [{ queryKey: performanceQueryKeys.objectiveTemplates() }] }
  );
}

export function useSetObjectiveTemplateArchived() {
  const client = useMemo(() => createPlatformApiClient(), []);
  return useApiMutation<
    ObjectiveTemplateDto,
    { templateId: string; version: number; archived: boolean }
  >(
    ({ templateId, version, archived }) =>
      client.post<ObjectiveTemplateDto>(
        archived
          ? performancePaths.objectiveTemplateArchive(templateId)
          : performancePaths.objectiveTemplateRestore(templateId),
        undefined,
        ifMatch(version)
      ),
    { invalidateQueries: [{ queryKey: performanceQueryKeys.objectiveTemplates() }] }
  );
}
