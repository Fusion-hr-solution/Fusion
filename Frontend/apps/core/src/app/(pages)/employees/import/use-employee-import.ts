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
  EmployeeImportSchemaDto,
  EmployeeImportSessionDto,
} from "./employee-import.types";

const EMPLOYEE_IMPORT_BASE_PATH = "/corehr/employees/import";

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
  sessionId: string | null
): UseApiQueryResult<EmployeeImportSessionDto> {
  const { user, isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess = canAccessEmployeeRoster(user);

  const queryFn = useCallback(
    (signal: AbortSignal) => {
      if (!sessionId) {
        throw new Error("Employee import session id is required.");
      }

      return client.get<EmployeeImportSessionDto>(
        `${EMPLOYEE_IMPORT_BASE_PATH}/${sessionId}`,
        {
          signal,
        }
      );
    },
    [client, sessionId]
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
