// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";
import type { GuardrailImpactPreviewDto, GuardrailsDto } from "@repo/api";
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
    createPlatformApiClient: () => ({
      get: mockGet,
      post: mockPost,
      put: mockPut,
      delete: mockDelete,
    }),
  };
});

vi.mock("sonner", () => ({ toast }));

vi.mock("@/components/controls/measurement-type-picker", () => ({
  MeasurementTypePicker: ({ value, onChange }: { value: string; onChange: (v: string) => void }) =>
    createElement("input", {
      "data-testid": "measurement",
      value,
      onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    }),
}));

import { ApiError, performancePaths } from "@repo/api";
import { ApiQueryProvider, createApiQueryClient } from "@repo/api/query";
import { GuardrailsEditor } from "./guardrails-editor";

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

function guardrails(overrides: Partial<GuardrailsDto> = {}): GuardrailsDto {
  return {
    id: "g1",
    version: 5,
    minObjectivesPerPlan: 1,
    maxObjectivesPerPlan: 10,
    minManagerValidationSlaDays: 1,
    maxManagerValidationSlaDays: 30,
    permittedWeightDecimalPlaces: 0,
    maxAllowedWeightingValues: 10,
    supportedMeasurementTypes: "Quantitative,Qualitative",
    maxTemplateTitleLength: 150,
    maxTemplateDescriptionLength: 500,
    maxTemplateTags: 10,
    ...overrides,
  };
}

function renderEditor(onSaved = vi.fn()) {
  render(
    createElement(GuardrailsEditor, {
      appliedGuardrails: guardrails(),
      onSaved,
    }),
    { wrapper: createWrapper() },
  );
  return { onSaved };
}

const applyButton = () => screen.getByRole("button", { name: /Apply/ }) as HTMLButtonElement;
const applyPath = performancePaths.platformGuardrailsApply();

function makeDirty() {
  fireEvent.change(screen.getByTestId("measurement"), { target: { value: "Quantitative" } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GuardrailsEditor", () => {
  it("applies limits in one atomic step when there are no conflicts", async () => {
    mockPost.mockResolvedValue({ applied: true, guardrails: guardrails(), impact: null });
    const { onSaved } = renderEditor();

    makeDirty();
    await waitFor(() => expect(applyButton().disabled).toBe(false));
    fireEvent.click(applyButton());

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mockPost.mock.calls[0]?.[0]).toBe(applyPath);
    expect(toast.success).toHaveBeenCalled();
  });

  it("blocks and shows the reasons on conflict, persisting nothing", async () => {
    mockPost.mockResolvedValue({
      applied: false,
      guardrails: null,
      impact: {
        hasConflicts: true,
        affectedTenantPolicyCount: 3,
        tenantPolicyConflicts: [{ reason: "Objective max below active tenant policy", affectedCount: 3 }],
        standardSetupConflicts: ["Standard setup objectives exceed the proposed maximum"],
      } satisfies GuardrailImpactPreviewDto,
    });
    const { onSaved } = renderEditor();

    makeDirty();
    fireEvent.click(applyButton());

    await screen.findByText("Blocked");
    expect(screen.getByText(/Objective max below active tenant policy/)).not.toBeNull();
    expect(onSaved).not.toHaveBeenCalled();
    // Entered values are preserved so the admin can correct them.
    expect((screen.getByTestId("measurement") as HTMLInputElement).value).toBe("Quantitative");
  });

  it("preserves entered values and shows the reason when apply fails", async () => {
    mockPost.mockRejectedValue(new ApiError(500, "Server Error", ["Server error"], null));
    const { onSaved } = renderEditor();

    makeDirty();
    fireEvent.click(applyButton());

    await screen.findByText("Server error");
    expect(screen.getByText("Limits not applied")).not.toBeNull();
    expect((screen.getByTestId("measurement") as HTMLInputElement).value).toBe("Quantitative");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("discards edits back to the applied limits", async () => {
    renderEditor();

    makeDirty();
    await waitFor(() => expect(applyButton().disabled).toBe(false));

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    expect((screen.getByTestId("measurement") as HTMLInputElement).value).toBe(
      "Quantitative,Qualitative",
    );
    expect(applyButton().disabled).toBe(true);
  });
});
