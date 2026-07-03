// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";
import type * as RepoApi from "@repo/api";

const { mockGet, mockPost, mockPut, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockDelete: vi.fn(),
}));

const access = vi.hoisted(() => ({ canManage: true }));

vi.mock("@repo/api", async () => {
  const actual = await vi.importActual<typeof RepoApi>("@repo/api");
  return {
    ...actual,
    createPlatformApiClient: () => ({ get: mockGet, post: mockPost, put: mockPut, delete: mockDelete }),
  };
});
vi.mock("@repo/auth", () => ({
  useAuth: () => ({ user: { userId: "u1" }, isLoading: false }),
  hasCorePermission: () => access.canManage,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { performancePaths } from "@repo/api";
import { ApiQueryProvider, createApiQueryClient } from "@repo/api/query";
import { TemplateCategoriesManager } from "./template-categories-manager";

function createWrapper() {
  const client = createApiQueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function TestQueryProvider({ children }: PropsWithChildren) {
    return createElement(ApiQueryProvider, { client }, children);
  }
  TestQueryProvider.displayName = "TestQueryProvider";
  return TestQueryProvider;
}

function renderManager() {
  return render(createElement(TemplateCategoriesManager), { wrapper: createWrapper() });
}

beforeEach(() => {
  vi.clearAllMocks();
  access.canManage = true;
});

describe("TemplateCategoriesManager", () => {
  it("renders nothing without the manage-categories permission", () => {
    access.canManage = false;
    const { container } = renderManager();
    expect(container.firstChild).toBeNull();
  });

  it("shows an empty state when there are no categories", async () => {
    mockGet.mockResolvedValue([]);
    renderManager();
    await screen.findByText(/No categories yet/);
  });

  it("derives a code and creates a category", async () => {
    mockGet.mockResolvedValue([]);
    mockPost.mockResolvedValue({ id: "c1", name: "Leadership", code: "LEADERSHIP", status: "Active" });
    renderManager();
    await screen.findByText(/No categories yet/);

    fireEvent.click(screen.getByRole("button", { name: /New category/ }));
    fireEvent.change(screen.getByPlaceholderText("e.g. Leadership"), {
      target: { value: "Leadership" },
    });
    // Derived code preview is shown before submit.
    await screen.findByText("LEADERSHIP");

    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    expect(mockPost.mock.calls[0]?.[0]).toBe(performancePaths.templateCategories());
    expect(mockPost.mock.calls[0]?.[1]).toEqual({ code: "LEADERSHIP", name: "Leadership", description: null });
  });

  it("archives an active category", async () => {
    mockGet.mockResolvedValue([{ id: "c1", name: "Leadership", code: "LEADERSHIP", status: "Active" }]);
    mockPost.mockResolvedValue({ id: "c1", status: "Archived" });
    renderManager();
    await screen.findByText("Leadership");

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    expect(mockPost.mock.calls[0]?.[0]).toBe(performancePaths.templateCategoryArchive("c1"));
  });
});
