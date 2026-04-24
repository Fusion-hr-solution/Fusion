"use client";

import { useCallback, useMemo } from "react";
import { createPlatformApiClient } from "@repo/api";
import {
  useApiMutation,
  useApiQuery,
  type UseApiMutationResult,
  type UseApiQueryResult,
} from "@repo/api/react";
import { useAuth } from "@repo/auth";
import { canAccessEmployeeRoster } from "@/lib/employee-roster-access";
import type {
  EmployeeImportPreviewFilter,
  EmployeeImportSchemaDto,
  EmployeeImportSessionDto,
} from "./employee-import.types";

const EMPLOYEE_IMPORT_BASE_PATH = "/corehr/employees/import";

type EmployeeImportPreviewQuery = {
  pageNumber?: number;
  previewFilter?: EmployeeImportPreviewFilter;
  groupKey?: string | null;
};

type ValidateEmployeeImportInput = {
  sessionId: string;
} & EmployeeImportPreviewQuery;

function buildPreviewQueryString(query?: EmployeeImportPreviewQuery) {
  const params = new URLSearchParams();

  if ((query?.pageNumber ?? 1) > 1) {
    params.set("previewPageNumber", String(query?.pageNumber));
  }

  if (query?.previewFilter === "affected") {
    params.set("previewFilter", query.previewFilter);
  }

  if (query?.groupKey) {
    params.set("groupKey", query.groupKey);
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

  return useApiQuery(queryFn, {
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
  const previewQueryString = buildPreviewQueryString(previewQuery);

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

  return useApiQuery(queryFn, {
    enabled: isAuthenticated && canAccess && !!sessionId,
  });
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
      )
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
