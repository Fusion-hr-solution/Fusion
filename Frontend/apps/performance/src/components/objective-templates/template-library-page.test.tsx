// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";
import type * as RepoApi from "@repo/api";

const { mockGet, mockPost, mockPut, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockDelete: vi.fn(),
}));

const access = vi.hoisted(() => ({ canView: true, canManage: true, categories: false }));

vi.mock("@repo/api", async () => {
  const actual = await vi.importActual<typeof RepoApi>("@repo/api");
  return {
    ...actual,
    createPlatformApiClient: () => ({ get: mockGet, post: mockPost, put: mockPut, delete: mockDelete }),
  };
});

vi.mock("@repo/auth", () => ({
  useAuth: () => ({ user: { userId: "u1", roles: ["HRAdmin"] }, isLoading: false }),
  canViewObjectiveLibrary: () => access.canView,
  canManageObjectiveLibrary: () => access.canManage,
  hasCorePermission: () => access.categories,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("./template-editor", () => ({ TemplateEditor: () => null }));
vi.mock("@/components/template-categories/template-categories-manager", () => ({
  TemplateCategoriesManager: () => null,
}));

import { ApiQueryProvider, createApiQueryClient } from "@repo/api/query";
import { TemplateLibraryPage } from "./template-library-page";

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

function paged(items: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    items,
    totalCount: items.length,
    page: 1,
    pageSize: 20,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
    ...overrides,
  };
}

function template(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    status: "Active",
    activeRevision: {
      title: "Revenue growth",
      measurementType: "Quantitative",
      categoryId: null,
      applicabilityValidationState: "Resolved",
    },
    draftRevision: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  access.canView = true;
  access.canManage = true;
  access.categories = false;
});

function renderPage() {
  render(createElement(TemplateLibraryPage), { wrapper: createWrapper() });
}

describe("TemplateLibraryPage states", () => {
  it("shows a permission notice when the user cannot view the library", () => {
    access.canView = false;
    renderPage();
    expect(screen.getByText("Access restricted")).not.toBeNull();
  });

  it("renders templates with their status", async () => {
    mockGet.mockResolvedValue(paged([template()]));
    renderPage();
    await screen.findByText("Revenue growth");
  });

  it("shows an empty-library state when there are no templates and no filters", async () => {
    mockGet.mockResolvedValue(paged([]));
    renderPage();
    await screen.findByText("No templates yet");
  });

  it("shows a distinct no-results state when filters exclude everything", async () => {
    mockGet.mockResolvedValue(paged([]));
    renderPage();
    await screen.findByText("No templates yet");

    fireEvent.change(screen.getByPlaceholderText("Search templates…"), {
      target: { value: "zzz" },
    });

    await screen.findByText("No templates match these filters");
  });

  it("hides create and disables edit for view-only users", async () => {
    access.canManage = false;
    mockGet.mockResolvedValue(paged([template()]));
    renderPage();

    await screen.findByText("Revenue growth");
    expect(screen.queryByRole("button", { name: /New template/ })).toBeNull();
    expect((screen.getByRole("button", { name: "Edit" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("offers create for managers", async () => {
    mockGet.mockResolvedValue(paged([template()]));
    renderPage();
    await screen.findByText("Revenue growth");
    expect(screen.getByRole("button", { name: /New template/ })).not.toBeNull();
  });
});
