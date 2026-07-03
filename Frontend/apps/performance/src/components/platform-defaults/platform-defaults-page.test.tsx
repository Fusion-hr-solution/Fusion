// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";
import type { PlatformDefaultsSummaryDto } from "@repo/api";
import type * as RepoApi from "@repo/api";

const { mockGet, mockPost, mockPut, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockDelete: vi.fn(),
}));

// Keep ApiError / performancePaths / performanceQueryKeys real; only swap the transport.
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

// The editors are covered by their own suites — stub them so
// these tests isolate the page's load/setup-state decisions.
vi.mock("./baseline-editor", () => ({ BaselineEditor: () => null }));
vi.mock("./guardrails-editor", () => ({ GuardrailsEditor: () => null }));

import { ApiError } from "@repo/api";
import { ApiQueryProvider, createApiQueryClient } from "@repo/api/query";
import { PlatformDefaultsPage } from "./platform-defaults-page";

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

function baseline(overrides: Record<string, unknown> = {}) {
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

function guardrails(overrides: Record<string, unknown> = {}) {
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

function healthySummary(): PlatformDefaultsSummaryDto {
  return {
    status: { tone: "success", label: "Ready", message: "All good" },
    appliedGuardrails: guardrails() as never,
    appliedBaseline: baseline() as never,
    lastUpdated: { action: "Standard setup applied", actorName: "Platform Admin", occurredAt: "2026-06-01T00:00:00Z" },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PlatformDefaultsPage load and setup states", () => {
  it("shows a loading state while the summary is in flight", () => {
    mockGet.mockReturnValue(new Promise(() => {}));

    const { container } = render(createElement(PlatformDefaultsPage), {
      wrapper: createWrapper(),
    });

    expect(container.querySelector("[aria-busy]")).not.toBeNull();
    // Summary chrome is not shown yet.
    expect(screen.queryByRole("tab", { name: "Standard setup" })).toBeNull();
  });

  it("shows a Platform Admin access-required state on 403", async () => {
    mockGet.mockRejectedValue(new ApiError(403, "Forbidden", ["Forbidden"], null));

    render(createElement(PlatformDefaultsPage), { wrapper: createWrapper() });

    await screen.findByText("Platform admin access required");
    // The generic retry affordance must not be offered for an authorization failure.
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("shows a recoverable error and retries the summary load", async () => {
    mockGet.mockRejectedValue(new ApiError(500, "Server Error", ["boom"], null));

    render(createElement(PlatformDefaultsPage), { wrapper: createWrapper() });

    await screen.findByText("Could not load defaults");
    const retry = screen.getByRole("button", { name: "Try again" });

    fireEvent.click(retry);

    await waitFor(() => expect(mockGet.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it("renders the applied standard setup and limits when healthy", async () => {
    mockGet.mockResolvedValue(healthySummary());

    render(createElement(PlatformDefaultsPage), { wrapper: createWrapper() });

    await screen.findByRole("tab", { name: "Standard setup" });
    expect(screen.getByRole("tab", { name: "Limits" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "History" })).toBeNull();
    // Applied baseline + guardrails read as live, not empty.
    expect(screen.getAllByText("Applied").length).toBeGreaterThanOrEqual(2);
  });

  it("shows an explicit not-configured state instead of zeroed applied values", async () => {
    mockGet.mockResolvedValue({
      status: { tone: "neutral", label: "Not configured", message: "" },
      appliedGuardrails: null,
      appliedBaseline: null,
      lastUpdated: null,
    } as PlatformDefaultsSummaryDto);

    render(createElement(PlatformDefaultsPage), { wrapper: createWrapper() });

    await screen.findByRole("tab", { name: "Standard setup" });
    // Both the baseline and limits summary read as missing/empty rather than 0.
    expect(screen.getAllByText("Missing").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Empty").length).toBeGreaterThanOrEqual(2);
  });

});
