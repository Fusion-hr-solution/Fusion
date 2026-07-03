// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";
import type { PolicyVersionDto } from "@repo/api";
import type * as RepoApi from "@repo/api";

const { mockPost } = vi.hoisted(() => ({
  mockPost: vi.fn(),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@repo/api", async () => {
  const actual = await vi.importActual<typeof RepoApi>("@repo/api");
  return {
    ...actual,
    createPlatformApiClient: () => ({ post: mockPost }),
  };
});
vi.mock("sonner", () => ({ toast }));

vi.mock("@/components/controls/weight-preset-editor", () => ({
  WeightPresetEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) =>
    createElement("input", {
      "data-testid": "weights",
      value,
      onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    }),
}));
vi.mock("@/components/controls/measurement-type-picker", () => ({
  MeasurementTypePicker: ({ value }: { value: string }) =>
    createElement("span", { "data-testid": "measurement" }, value),
}));
vi.mock("@/components/controls/strategic-alignment-select", () => ({
  StrategicAlignmentSelect: ({ value }: { value: string }) =>
    createElement("span", { "data-testid": "alignment" }, value),
}));

import { ApiError, performancePaths } from "@repo/api";
import { ApiQueryProvider, createApiQueryClient } from "@repo/api/query";
import { PolicyApplyEditor } from "./policy-apply-editor";

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

function version(overrides: Partial<PolicyVersionDto> = {}): PolicyVersionDto {
  return {
    id: "v1",
    policyId: "p1",
    versionNumber: 3,
    status: "Active",
    maxObjectivesPerPlan: 7,
    allowedWeightValues: "5,10,15,20,25,30,40,50",
    managerValidationSlaDays: 10,
    cascadeMode: "Optional",
    measurementTypes: "Quantitative,Qualitative",
    attachmentsEnabled: true,
    version: 3,
    sourceVersionId: null,
    sourceBaselineVersionId: null,
    createdByUserId: "u1",
    createdByName: "Tester",
    activatedAt: "2026-07-01T00:00:00Z",
    activatedByUserId: "u1",
    activatedByName: "Tester",
    changeSummary: null,
    supersededAt: null,
    ...overrides,
  };
}

function renderEditor(currentPolicy = version()) {
  const onApplied = vi.fn();
  const onCancel = vi.fn();
  render(
    createElement(PolicyApplyEditor, {
      currentPolicy,
      onApplied,
      onCancel,
    }),
    { wrapper: createWrapper() },
  );
  return { onApplied, onCancel };
}

const applyButton = () => screen.getByRole("button", { name: /Apply policy/ }) as HTMLButtonElement;
const applyPath = performancePaths.policyApply();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PolicyApplyEditor", () => {
  it("keeps edits local until Apply", () => {
    renderEditor();
    fireEvent.change(screen.getByTestId("weights"), { target: { value: "10,20,30,40" } });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("applies the full proposed policy with optimistic concurrency", async () => {
    mockPost.mockResolvedValue(version({ id: "v2", versionNumber: 4, version: 4 }));
    const { onApplied } = renderEditor();

    fireEvent.change(screen.getByTestId("weights"), { target: { value: "10,20,30,40" } });
    fireEvent.click(applyButton());

    await waitFor(() => expect(onApplied).toHaveBeenCalled());
    const [path, body, options] = mockPost.mock.calls[0]!;
    expect(path).toBe(applyPath);
    expect(body.allowedWeightValues).toBe("10,20,30,40");
    expect(options).toEqual({ headers: { "If-Match": '"3"' } });
  });

  it("blocks Apply when the weights cannot total 100%", () => {
    renderEditor();
    fireEvent.change(screen.getByTestId("weights"), { target: { value: "3" } });
    expect(applyButton().disabled).toBe(true);
  });

  it("preserves entered values and shows the reason when Apply fails", async () => {
    mockPost.mockRejectedValue(new ApiError(409, "Conflict", ["The current policy changed. Review before applying again."], null));
    const { onApplied } = renderEditor();

    fireEvent.change(screen.getByTestId("weights"), { target: { value: "10,20,30,40" } });
    fireEvent.click(applyButton());

    await screen.findByText("The policy could not be applied.");
    expect(screen.getByText("The current policy changed. Review before applying again.")).not.toBeNull();
    expect((screen.getByTestId("weights") as HTMLInputElement).value).toBe("10,20,30,40");
    expect(onApplied).not.toHaveBeenCalled();
  });

  it("shows a review panel before Apply", () => {
    renderEditor();
    fireEvent.change(screen.getByLabelText("Maximum objectives per plan"), { target: { value: "5" } });
    expect(screen.getByText("Review before Apply")).not.toBeNull();
    expect(screen.getByText("Maximum objectives:")).not.toBeNull();
  });
});
