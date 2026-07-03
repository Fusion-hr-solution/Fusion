// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";
import type { BaselineVersionDto, GuardrailsDto } from "@repo/api";
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

// Leaf controls exercise their own concerns; stub them as plain inputs so we can
// drive form state deterministically without Radix interaction.
vi.mock("@/components/controls/weight-preset-editor", () => ({
  WeightPresetEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) =>
    createElement("input", {
      "data-testid": "weights",
      value,
      onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    }),
}));
vi.mock("@/components/controls/measurement-type-picker", () => ({
  MeasurementTypePicker: ({ value, onChange }: { value: string; onChange: (v: string) => void }) =>
    createElement("input", {
      "data-testid": "measurement",
      value,
      onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    }),
}));
vi.mock("@/components/controls/strategic-alignment-select", () => ({
  StrategicAlignmentSelect: ({ value }: { value: string }) =>
    createElement("span", { "data-testid": "alignment" }, value),
}));

import { performancePaths } from "@repo/api";
import { ApiQueryProvider, createApiQueryClient } from "@repo/api/query";
import { BaselineEditor } from "./baseline-editor";

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

function baseline(overrides: Partial<BaselineVersionDto> = {}): BaselineVersionDto {
  return {
    id: "b1",
    versionNumber: 3,
    status: "Published",
    maxObjectivesPerPlan: 7,
    allowedWeightValues: "5,10,15,20,25,30,40,50",
    managerValidationSlaDays: 10,
    cascadeMode: "Optional",
    measurementTypes: "Quantitative,Qualitative",
    attachmentsEnabled: true,
    publishedAt: "2026-01-01T00:00:00Z",
    supersededAt: null,
    ...overrides,
  };
}

const guardrails: GuardrailsDto = {
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
};

function renderEditor(onSaved = vi.fn()) {
  render(
    createElement(BaselineEditor, {
      appliedPolicy: baseline(),
      guardrails,
      onSaved,
    }),
    { wrapper: createWrapper() },
  );
  return { onSaved };
}

const applyButton = () => screen.getByRole("button", { name: /Apply/ }) as HTMLButtonElement;
const applyPath = performancePaths.platformBaselineApply();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BaselineEditor", () => {
  it("disables Apply when the form matches the applied standard setup", () => {
    renderEditor();
    expect(applyButton().disabled).toBe(true);
  });

  it("applies the standard setup in one atomic step", async () => {
    mockPost.mockResolvedValue({ applied: true, baseline: baseline(), errors: [] });
    const { onSaved } = renderEditor();

    fireEvent.change(screen.getByTestId("weights"), { target: { value: "10,20,30,40" } });
    await waitFor(() => expect(applyButton().disabled).toBe(false));

    fireEvent.click(applyButton());

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mockPost.mock.calls[0]?.[0]).toBe(applyPath);
    expect(toast.success).toHaveBeenCalled();
  });

  it("preserves entered values and surfaces the reason when apply is rejected", async () => {
    mockPost.mockResolvedValue({
      applied: false,
      baseline: null,
      errors: ["Standard setup exceeds platform limits"],
    });
    const { onSaved } = renderEditor();

    fireEvent.change(screen.getByTestId("weights"), { target: { value: "10,20,30,40" } });
    await waitFor(() => expect(applyButton().disabled).toBe(false));
    fireEvent.click(applyButton());

    await screen.findByText("Standard setup exceeds platform limits");
    expect(screen.getByText("Standard setup not applied")).not.toBeNull();
    expect((screen.getByTestId("weights") as HTMLInputElement).value).toBe("10,20,30,40");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("discards edits back to the applied standard setup", async () => {
    renderEditor();

    fireEvent.change(screen.getByTestId("weights"), { target: { value: "10,20,30,40" } });
    await waitFor(() => expect(applyButton().disabled).toBe(false));

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    expect((screen.getByTestId("weights") as HTMLInputElement).value).toBe(
      "5,10,15,20,25,30,40,50",
    );
    expect(applyButton().disabled).toBe(true);
  });

  it("blocks Apply when the weights cannot total 100%", async () => {
    renderEditor();

    fireEvent.change(screen.getByTestId("weights"), { target: { value: "3" } });

    await screen.findByText("Fix before applying");
    expect(applyButton().disabled).toBe(true);
    expect(mockPost).not.toHaveBeenCalled();
  });
});
