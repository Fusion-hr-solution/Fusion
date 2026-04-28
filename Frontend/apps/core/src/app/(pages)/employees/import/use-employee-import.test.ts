// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

type ApiReactModule = typeof import("@repo/api/react");

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
  canAccessCoreSetup: (user: { roles?: string[] } | null) =>
    !!user?.roles?.includes("HRAdmin") &&
    !user?.roles?.includes("PlatformAdmin"),
}));

vi.mock("@repo/api/react", async () => {
  const actual = await vi.importActual<ApiReactModule>("@repo/api/react");
  return actual;
});

import {
  useDownloadEmployeeImportTemplate,
  useEmployeeImportSchema,
  useEmployeeImportSession,
  useUploadEmployeeImport,
} from "./use-employee-import";

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

    const { result } = renderHook(() => useEmployeeImportSchema());

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
      hasMorePreviewRows: false,
      expiresAt: "2026-04-22T00:00:00Z",
      employeeImportSchema: { canonicalFields: [] },
    });

    const { result } = renderHook(() => useEmployeeImportSession("session-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith(
      "/corehr/employees/import/session-1",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });
});

describe("useUploadEmployeeImport", () => {
  it("posts the selected csv file as form data", async () => {
    mockPost.mockResolvedValue({ id: "session-1" });

    const { result } = renderHook(() => useUploadEmployeeImport());
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

    const { result } = renderHook(() => useDownloadEmployeeImportTemplate());

    await act(async () => {
      await result.current.mutateAsync(undefined);
    });

    expect(mockGet).toHaveBeenCalledWith(
      "/corehr/employees/import/template",
      expect.objectContaining({ responseType: "blob" })
    );
  });
});
