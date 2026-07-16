// @vitest-environment happy-dom

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ObjectivePlanningConfigurationPage } from "./objective-planning-configuration-page";

const queryState = vi.hoisted(() => ({
  data: {
    isConfigured: true,
    options: {
      maxObjectiveCountLimit: 5,
      supportedAllowedWeights: "5,10,15,20,25,30,40,50",
      quantitativeAvailable: true,
      qualitativeAvailable: true,
    },
    configuration: {
      id: "version-1",
      configurationId: "configuration-1",
      isConfigured: true,
      maxObjectiveCount: 4,
      allowedWeights: "25,50",
      quantitativeEnabled: true,
      qualitativeEnabled: true,
      version: 7,
      sourceVersionId: null,
      sourceStartingConfigurationId: "starting-1",
      createdByUserId: "user-1",
      createdByName: "Tenant Admin",
      appliedAt: "2026-07-04T00:00:00Z",
      changeSummary: null,
    },
  },
  error: null as Error | null,
}));

vi.mock("@repo/auth", () => ({
  useAuth: () => ({
    user: { fullName: "Tenant Admin" },
    isLoading: false,
  }),
  canViewObjectivePlanningConfiguration: () => true,
  canManageObjectivePlanningConfiguration: () => true,
}));

vi.mock("@repo/api", async () => {
  const actual = await vi.importActual("@repo/api");
  return {
    ...actual,
    createPlatformApiClient: () => ({
      get: vi.fn(),
      post: vi.fn(),
    }),
  };
});

vi.mock("@repo/api/query", () => ({
  useApiQuery: () => ({
    data: queryState.data,
    isLoading: false,
    isFetching: false,
    error: queryState.error,
    refetch: vi.fn(),
    invalidate: vi.fn(),
  }),
  useApiMutation: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    data: undefined,
    error: null,
    isLoading: false,
    reset: vi.fn(),
  }),
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
  }
  root = null;
  container = null;
});

function renderPage() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<ObjectivePlanningConfigurationPage />));
  return container;
}

describe("ObjectivePlanningConfigurationPage", () => {
  it("renders tenant planning configuration with bounded platform choices", () => {
    const page = renderPage();

    expect(page.textContent).toContain("Objective planning configuration");
    expect(page.textContent).not.toContain("Objective policy");
    expect(page.textContent).not.toContain("Template");

    expect(page.textContent).toContain("Allowed weight menu");
    expect(page.textContent).toContain("objective importance");
    expect(
      Array.from(page.querySelectorAll("button")).some((button) => button.textContent === "50%"),
    ).toBe(true);
    expect(
      Array.from(page.querySelectorAll("button")).some((button) => button.textContent === "100%"),
    ).toBe(false);
    expect(
      Array.from(page.querySelectorAll("button")).some((button) => button.textContent === "Edit"),
    ).toBe(false);
    expect(
      Array.from(page.querySelectorAll("button")).some((button) => button.textContent === "Validate"),
    ).toBe(false);
    expect(
      Array.from(page.querySelectorAll("button")).some((button) => button.textContent === "Apply changes"),
    ).toBe(true);
  });
});
