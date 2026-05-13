// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  isAuthenticated: true,
  user: {
    userId: "hr-1",
    email: "hr@example.com",
    fullName: "HR Admin",
    roles: ["HRAdmin"],
  },
}));

vi.mock("@repo/api", () => ({
  createPlatformApiClient: () => ({
    get: mockGet,
    post: mockPost,
  }),
}));

vi.mock("@repo/auth", () => ({
  useAuth: () => authState,
  canAccessCorePeople: (user: { roles?: string[] } | null) =>
    !!user?.roles?.includes("HRAdmin") &&
    !user?.roles?.includes("PlatformAdmin"),
}));

vi.mock("@repo/api/query", async () => {
  const actual = await vi.importActual("@repo/api/query");
  return actual;
});

import { ApiQueryProvider, createApiQueryClient } from "@repo/api/query";
import {
  useApplyEmployeeImport,
  useDownloadEmployeeImportTemplate,
  useEmployeeImportHistory,
  useEmployeeImportHistoryDetail,
  useEmployeeImportSchema,
  useEmployeeImportSession,
  useUploadEmployeeImport,
  useValidateEmployeeImport,
} from "./use-employee-import";

function createWrapper() {
  const client = createApiQueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function TestQueryProvider({ children }: PropsWithChildren) {
    return createElement(ApiQueryProvider, { client }, children);
  }

  TestQueryProvider.displayName = "TestQueryProvider";

  return TestQueryProvider;
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.user = {
    userId: "hr-1",
    email: "hr@example.com",
    fullName: "HR Admin",
    roles: ["HRAdmin"],
  };
});

describe("useEmployeeImportSchema", () => {
  it("loads the employee import schema endpoint", async () => {
    mockGet.mockResolvedValue({ canonicalFields: [] });

    const { result } = renderHook(() => useEmployeeImportSchema(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith(
      "/corehr/employees/import/schema",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });
});

describe("useEmployeeImportSession", () => {
  it("loads the selected import session", async () => {
    mockGet.mockResolvedValue({
      id: "session-1",
      stage: "PreviewReady",
      version: 1,
      sourceFileName: "employees.csv",
      sourceFileSizeBytes: 1234,
      sourceRowCount: 1,
      sourceHeaders: [],
      sampleRows: [],
      previewRows: [],
      previewPageNumber: 1,
      previewPageSize: 25,
      previewPageCount: 1,
      totalPreviewRowCount: 1,
      hasMorePreviewRows: false,
      validationSummary: {
        totalRows: 1,
        validRows: 0,
        errorCount: 0,
        warningCount: 0,
      },
      validationIssues: [],
      appliedAt: null,
      expiresAt: "2026-04-22T00:00:00Z",
      employeeImportSchema: { canonicalFields: [] },
      canValidate: true,
      canApply: false,
    });

    const { result } = renderHook(() => useEmployeeImportSession("session-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith(
      "/corehr/employees/import/session-1",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("passes pagination and filter query parameters when requested", async () => {
    mockGet.mockResolvedValue({
      id: "session-1",
      stage: "Validated",
      version: 1,
      sourceFileName: "employees.csv",
      sourceFileSizeBytes: 1234,
      sourceRowCount: 30,
      sourceHeaders: [],
      sampleRows: [],
      previewRows: [],
      previewPageNumber: 2,
      previewPageSize: 25,
      previewPageCount: 2,
      totalPreviewRowCount: 30,
      hasMorePreviewRows: false,
      validationSummary: {
        totalRows: 30,
        validRows: 25,
        errorCount: 5,
        warningCount: 0,
      },
      validationIssues: [],
      appliedAt: null,
      expiresAt: "2026-04-22T00:00:00Z",
      employeeImportSchema: { canonicalFields: [] },
      canValidate: true,
      canApply: false,
    });

    const { result } = renderHook(
      () =>
        useEmployeeImportSession("session-1", {
          pageNumber: 2,
          pageSize: 50,
          previewFilter: "affected",
          groupKey: "missingRequiredData:email",
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith(
      "/corehr/employees/import/session-1?previewPageNumber=2&previewPageSize=50&previewFilter=affected&groupKey=missingRequiredData%3Aemail",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("clamps out-of-range preview paging inputs to the current contract", async () => {
    mockGet.mockResolvedValue({
      id: "session-1",
      stage: "Validated",
      version: 1,
      sourceFileName: "employees.csv",
      sourceFileSizeBytes: 1234,
      sourceRowCount: 30,
      sourceHeaders: [],
      sampleRows: [],
      previewRows: [],
      previewPageNumber: 1,
      previewPageSize: 100,
      previewPageCount: 1,
      totalPreviewRowCount: 30,
      hasMorePreviewRows: false,
      validationSummary: {
        totalRows: 30,
        validRows: 25,
        errorCount: 5,
        warningCount: 0,
      },
      validationIssues: [],
      appliedAt: null,
      expiresAt: "2026-04-22T00:00:00Z",
      employeeImportSchema: { canonicalFields: [] },
      canValidate: true,
      canApply: false,
    });

    const { result } = renderHook(
      () =>
        useEmployeeImportSession("session-1", {
          pageNumber: 0,
          pageSize: 999,
          previewFilter: "affected",
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith(
      "/corehr/employees/import/session-1?previewPageSize=100&previewFilter=affected",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });
});

describe("useUploadEmployeeImport", () => {
  it("posts the selected csv file as form data", async () => {
    mockPost.mockResolvedValue({ id: "session-1" });

    const { result } = renderHook(() => useUploadEmployeeImport(), {
      wrapper: createWrapper(),
    });
    const file = new File(["csv"], "employees.csv", { type: "text/csv" });

    await act(async () => {
      await result.current.mutateAsync(file);
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/corehr/employees/import",
      expect.any(FormData)
    );

    const [, body] = mockPost.mock.calls[0]!;
    expect(body.get("file")).toBe(file);
  });
});

describe("useDownloadEmployeeImportTemplate", () => {
  it("requests the csv template as a blob", async () => {
    mockGet.mockResolvedValue(new Blob(["template"]));

    const { result } = renderHook(() => useDownloadEmployeeImportTemplate(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync(undefined);
    });

    expect(mockGet).toHaveBeenCalledWith(
      "/corehr/employees/import/template",
      expect.objectContaining({ responseType: "blob" })
    );
  });
});

describe("useValidateEmployeeImport", () => {
  it("posts to validate endpoint for a session", async () => {
    mockPost.mockResolvedValue({ id: "session-1" });

    const { result } = renderHook(() => useValidateEmployeeImport(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ sessionId: "session-1" });
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/corehr/employees/import/session-1/validate",
      undefined
    );
  });

  it("includes preview query parameters when validating", async () => {
    mockPost.mockResolvedValue({ id: "session-1" });

    const { result } = renderHook(() => useValidateEmployeeImport(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        sessionId: "session-1",
        pageNumber: 2,
        pageSize: 10,
        previewFilter: "affected",
        groupKey: "missingRequiredData:email",
      });
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/corehr/employees/import/session-1/validate?previewPageNumber=2&previewPageSize=10&previewFilter=affected&groupKey=missingRequiredData%3Aemail",
      undefined
    );
  });

  it("clamps invalid preview query parameters when validating", async () => {
    mockPost.mockResolvedValue({ id: "session-1" });

    const { result } = renderHook(() => useValidateEmployeeImport(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        sessionId: "session-1",
        pageNumber: -4,
        pageSize: 0,
        previewFilter: "affected",
      });
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/corehr/employees/import/session-1/validate?previewPageSize=1&previewFilter=affected",
      undefined
    );
  });
});

describe("useApplyEmployeeImport", () => {
  it("posts to the apply endpoint for a session", async () => {
    mockPost.mockResolvedValue({ historyId: "history-1" });

    const { result } = renderHook(() => useApplyEmployeeImport(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ sessionId: "session-1" });
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/corehr/employees/import/session-1/apply",
      undefined
    );
  });
});

describe("useEmployeeImportHistory", () => {
  it("loads import history with paging query parameters", async () => {
    mockGet.mockResolvedValue({
      items: [],
      pageNumber: 2,
      pageSize: 5,
      totalCount: 0,
      pageCount: 1,
    });

    const { result } = renderHook(
      () => useEmployeeImportHistory({ pageNumber: 2, pageSize: 5 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith(
      "/corehr/employees/import/history?pageNumber=2&pageSize=5",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });
});

describe("useEmployeeImportHistoryDetail", () => {
  it("loads a selected import history record", async () => {
    mockGet.mockResolvedValue({
      id: "history-1",
      unresolvedFollowUpIssues: [],
    });

    const { result } = renderHook(
      () => useEmployeeImportHistoryDetail("history-1"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith(
      "/corehr/employees/import/history/history-1",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });
});
