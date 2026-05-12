"use client";

import { useCallback, useMemo } from "react";
import { createPlatformApiClient } from "@repo/api";
import {
  keepPreviousData,
  useApiMutation,
  useApiQuery,
  type UseApiMutationResult,
  type UseApiQueryResult,
} from "@repo/api/query";
import { useAuth } from "@repo/auth";
import { canAccessEmployeeRoster } from "@/lib/employee-roster-access";
import {
  DEFAULT_EMPLOYEE_IMPORT_HISTORY_PAGE_SIZE,
  DEFAULT_EMPLOYEE_IMPORT_PREVIEW_PAGE_SIZE,
  employeeImportQueryKeys,
  employeeRosterQueryKeys,
  normalizeEmployeeImportHistoryQuery,
  normalizeEmployeeImportPreviewQuery,
  type EmployeeImportHistoryQuery,
  type EmployeeImportPreviewQuery,
} from "../employee-query-keys";
import type {
  EmployeeImportApplyResultDto,
  EmployeeImportHistoryDetailDto,
  EmployeeImportHistoryPageDto,
  EmployeeImportSchemaDto,
  EmployeeImportSessionDto,
} from "./employee-import.types";

const EMPLOYEE_IMPORT_BASE_PATH = "/corehr/employees/import";

type ValidateEmployeeImportInput = {
  sessionId: string;
} & EmployeeImportPreviewQuery;

type ApplyEmployeeImportInput = {
  sessionId: string;
};

function buildPreviewQueryString(query?: EmployeeImportPreviewQuery) {
  const params = new URLSearchParams();
  const normalizedQuery = normalizeEmployeeImportPreviewQuery(query);

  if (normalizedQuery.pageNumber > 1) {
    params.set("previewPageNumber", String(normalizedQuery.pageNumber));
  }

  if (normalizedQuery.pageSize !== DEFAULT_EMPLOYEE_IMPORT_PREVIEW_PAGE_SIZE) {
    params.set("previewPageSize", String(normalizedQuery.pageSize));
  }

  if (normalizedQuery.previewFilter === "affected") {
    params.set("previewFilter", normalizedQuery.previewFilter);
  }

  if (normalizedQuery.groupKey) {
    params.set("groupKey", normalizedQuery.groupKey);
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

function buildHistoryQueryString(query?: EmployeeImportHistoryQuery) {
  const params = new URLSearchParams();
  const normalizedQuery = normalizeEmployeeImportHistoryQuery(query);

  if (normalizedQuery.pageNumber > 1) {
    params.set("pageNumber", String(normalizedQuery.pageNumber));
  }

  if (normalizedQuery.pageSize !== DEFAULT_EMPLOYEE_IMPORT_HISTORY_PAGE_SIZE) {
    params.set("pageSize", String(normalizedQuery.pageSize));
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export function useEmployeeImportSchema(): UseApiQueryResult<EmployeeImportSchemaDto> {
  const { user, isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess = canAccessEmployeeRoster(user);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<EmployeeImportSchemaDto>(
        `${EMPLOYEE_IMPORT_BASE_PATH}/schema`,
        {
          signal,
        }
      ),
    [client]
  );

  return useApiQuery(employeeImportQueryKeys.schema(), queryFn, {
    enabled: isAuthenticated && canAccess,
  });
}

export function useEmployeeImportSession(
  sessionId: string | null,
  previewQuery?: EmployeeImportPreviewQuery
): UseApiQueryResult<EmployeeImportSessionDto> {
  const { user, isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess = canAccessEmployeeRoster(user);
  const normalizedPreviewQuery = useMemo(
    () => normalizeEmployeeImportPreviewQuery(previewQuery),
    [
      previewQuery?.groupKey,
      previewQuery?.pageNumber,
      previewQuery?.pageSize,
      previewQuery?.previewFilter,
    ]
  );
  const previewQueryString = buildPreviewQueryString(normalizedPreviewQuery);

  const queryFn = useCallback(
    (signal: AbortSignal) => {
      if (!sessionId) {
        throw new Error("Employee import session id is required.");
      }

      return client.get<EmployeeImportSessionDto>(
        `${EMPLOYEE_IMPORT_BASE_PATH}/${sessionId}${previewQueryString}`,
        {
          signal,
        }
      );
    },
    [client, previewQueryString, sessionId]
  );

  return useApiQuery(
    employeeImportQueryKeys.sessionView(
      sessionId ?? "pending",
      normalizedPreviewQuery
    ),
    queryFn,
    {
      enabled: isAuthenticated && canAccess && !!sessionId,
      placeholderData: keepPreviousData,
    }
  );
}

export function useUploadEmployeeImport(): UseApiMutationResult<
  EmployeeImportSessionDto,
  File
> {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    return client.post<EmployeeImportSessionDto>(
      EMPLOYEE_IMPORT_BASE_PATH,
      formData
    );
  });
}

export function useValidateEmployeeImport(): UseApiMutationResult<
  EmployeeImportSessionDto,
  ValidateEmployeeImportInput
> {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation(
    ({ sessionId, ...previewQuery }: ValidateEmployeeImportInput) =>
      client.post<EmployeeImportSessionDto>(
        `${EMPLOYEE_IMPORT_BASE_PATH}/${sessionId}/validate${buildPreviewQueryString(previewQuery)}`,
        undefined
      ),
    {
      invalidateQueries: (_data, args) => [
        { queryKey: employeeImportQueryKeys.session(args.sessionId) },
      ],
    }
  );
}

export function useApplyEmployeeImport(): UseApiMutationResult<
  EmployeeImportApplyResultDto,
  ApplyEmployeeImportInput
> {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation(
    ({ sessionId }: ApplyEmployeeImportInput) =>
      client.post<EmployeeImportApplyResultDto>(
        `${EMPLOYEE_IMPORT_BASE_PATH}/${sessionId}/apply`,
        undefined
      ),
    {
      invalidateQueries: (_data, args) => [
        { queryKey: employeeImportQueryKeys.session(args.sessionId) },
        { queryKey: employeeImportQueryKeys.history() },
        { queryKey: employeeRosterQueryKeys.all() },
      ],
    }
  );
}

export function useEmployeeImportHistory(
  query?: EmployeeImportHistoryQuery
): UseApiQueryResult<EmployeeImportHistoryPageDto> {
  const { user, isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess = canAccessEmployeeRoster(user);
  const normalizedHistoryQuery = useMemo(
    () => normalizeEmployeeImportHistoryQuery(query),
    [query?.pageNumber, query?.pageSize]
  );
  const historyQueryString = buildHistoryQueryString(query);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<EmployeeImportHistoryPageDto>(
        `${EMPLOYEE_IMPORT_BASE_PATH}/history${historyQueryString}`,
        {
          signal,
        }
      ),
    [client, historyQueryString]
  );

  return useApiQuery(
    employeeImportQueryKeys.historyPage(normalizedHistoryQuery),
    queryFn,
    {
      enabled: isAuthenticated && canAccess,
      placeholderData: keepPreviousData,
    }
  );
}

export function useEmployeeImportHistoryDetail(
  historyId: string | null
): UseApiQueryResult<EmployeeImportHistoryDetailDto> {
  const { user, isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess = canAccessEmployeeRoster(user);

  const queryFn = useCallback(
    (signal: AbortSignal) => {
      if (!historyId) {
        throw new Error("Employee import history id is required.");
      }

      return client.get<EmployeeImportHistoryDetailDto>(
        `${EMPLOYEE_IMPORT_BASE_PATH}/history/${historyId}`,
        {
          signal,
        }
      );
    },
    [client, historyId]
  );

  return useApiQuery(
    employeeImportQueryKeys.historyDetail(historyId ?? "pending"),
    queryFn,
    {
      enabled: isAuthenticated && canAccess && !!historyId,
    }
  );
}

export function useDownloadEmployeeImportTemplate(): UseApiMutationResult<
  Blob,
  void
> {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation(() =>
    client.get<Blob>(`${EMPLOYEE_IMPORT_BASE_PATH}/template`, {
      responseType: "blob",
    })
  );
}
