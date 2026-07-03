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
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@repo/api", async () => {
  const actual = await vi.importActual<typeof RepoApi>("@repo/api");
  return {
    ...actual,
    createPlatformApiClient: () => ({ get: mockGet, post: mockPost, put: mockPut, delete: mockDelete }),
  };
});
vi.mock("@repo/auth", () => ({
  useAuth: () => ({ user: { userId: "u1", roles: ["HRAdmin"] }, isLoading: false }),
  canManageObjectiveLibrary: () => true,
}));
vi.mock("sonner", () => ({ toast }));

// Stub the confirm dialog so its open/title is directly observable.
vi.mock("@/components/controls/confirm-dialog", () => ({
  ConfirmDialog: ({ open, title, onConfirm }: { open: boolean; title: string; onConfirm: () => void }) =>
    open
      ? createElement(
          "div",
          {},
          createElement("span", {}, title),
          createElement("button", { onClick: onConfirm }, "confirm-dialog-ok"),
        )
      : null,
}));

import { ApiError, performancePaths } from "@repo/api";
import { ApiQueryProvider, createApiQueryClient } from "@repo/api/query";
import { TemplateEditor } from "./template-editor";

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

const applicabilityEmpty = { orgUnits: [], jobTitles: [], workLocations: [], employmentTypes: [] };

/** Routes the shared GET mock by endpoint so each query gets a shape-correct response. */
function routeGets(templateResponse?: unknown) {
  mockGet.mockImplementation((path: string) => {
    if (path.includes("applicability")) return Promise.resolve(applicabilityEmpty);
    if (path.includes("template-categories")) return Promise.resolve([]);
    if (path.includes("/history")) return Promise.resolve([]);
    return Promise.resolve(templateResponse);
  });
}

function renderCreate() {
  routeGets();
  const onSaved = vi.fn();
  const onCancel = vi.fn();
  render(createElement(TemplateEditor, { mode: "create", onSaved, onCancel }), {
    wrapper: createWrapper(),
  });
  return { onSaved, onCancel };
}

const saveButton = () => screen.getByRole("button", { name: /Save draft/ }) as HTMLButtonElement;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TemplateEditor (create)", () => {
  it("disables Save until a title is entered", () => {
    renderCreate();
    expect(saveButton().disabled).toBe(true);
  });

  it("saves an incomplete Draft with only a title (completeness deferred to activation)", async () => {
    const { onSaved } = renderCreate();

    fireEvent.change(screen.getByPlaceholderText(/Increase customer retention/), {
      target: { value: "Retention" },
    });
    mockPost.mockResolvedValue({ id: "t9" });
    await waitFor(() => expect(saveButton().disabled).toBe(false));
    fireEvent.click(saveButton());

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mockPost.mock.calls[0]?.[0]).toBe(performancePaths.templateLibrary());
  });

  it("warns before switching measurement type when content would be cleared", async () => {
    renderCreate();

    fireEvent.click(screen.getByRole("button", { name: "Measurement" }));
    // Default is Qualitative — enter an expected outcome, then switch to Numeric.
    fireEvent.change(screen.getByPlaceholderText(/Describe the result this objective/), {
      target: { value: "Programme delivered" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Numeric target/ }));

    await screen.findByText("Switch measurement type?");
  });

  it("surfaces the reason and does not report success when creation fails", async () => {
    const { onSaved } = renderCreate();

    fireEvent.change(screen.getByPlaceholderText(/Increase customer retention/), {
      target: { value: "Retention" },
    });
    mockPost.mockRejectedValue(new ApiError(400, "Bad Request", ["Title already exists"], null));
    await waitFor(() => expect(saveButton().disabled).toBe(false));
    fireEvent.click(saveButton());

    await screen.findByText("Could not complete that action.");
    expect(screen.getByText("Title already exists")).not.toBeNull();
    expect(onSaved).not.toHaveBeenCalled();
  });
});

describe("TemplateEditor (edit)", () => {
  it("shows the activation requirements for an incomplete quantitative draft", async () => {
    routeGets({
      id: "t1",
      code: "TPL-1A2B3C4D",
      status: "Draft",
      activeRevision: null,
      draftRevision: {
        version: 1,
        versionNumber: 1,
        title: "Sales target",
        measurementType: "Quantitative",
        indicator: null,
        targetValue: null,
        unit: null,
        expectedOutcome: null,
        successCriteria: null,
        categoryId: null,
        applicabilityValidationState: "NotValidated",
      },
    });

    render(
      createElement(TemplateEditor, {
        mode: "edit",
        templateId: "t1",
        onSaved: vi.fn(),
        onCancel: vi.fn(),
      }),
      { wrapper: createWrapper() },
    );

    await screen.findByRole("button", { name: "Review" });
    fireEvent.click(screen.getByRole("button", { name: "Review" }));

    await screen.findByText(/Required before activation: Title, Category, Indicator, Target and unit|Required before activation: Category, Indicator, Target and unit/);
  });
});
