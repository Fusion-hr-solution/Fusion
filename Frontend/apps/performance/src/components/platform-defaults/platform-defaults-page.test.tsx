// @vitest-environment happy-dom

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlatformDefaultsPage } from "./platform-defaults-page";

const queryState = vi.hoisted(() => ({
  data: {
    isConfigured: false,
    configuration: null,
  },
  error: null as Error | null,
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
  act(() => root?.render(<PlatformDefaultsPage />));
  return container;
}

describe("PlatformDefaultsPage", () => {
  it("uses the lean platform configuration language and bounded weight choices", () => {
    const page = renderPage();

    expect(page.textContent).toContain("Platform performance configuration");
    expect(page.textContent).toContain("Not configured");
    expect(page.textContent).not.toContain("Template");
    expect(page.textContent).not.toContain("Guardrails");

    expect(page.textContent).toContain("Supported objective weights");
    expect(page.textContent).toContain("business importance");
    expect(
      Array.from(page.querySelectorAll("button")).some((button) => button.textContent === "25%"),
    ).toBe(true);
    expect(
      Array.from(page.querySelectorAll("button")).some((button) => button.textContent === "100%"),
    ).toBe(false);
    expect(
      Array.from(page.querySelectorAll("button")).some((button) => button.textContent === "Edit"),
    ).toBe(false);
    expect(
      Array.from(page.querySelectorAll("button")).some((button) => button.textContent === "Validate impact"),
    ).toBe(false);
    expect(
      Array.from(page.querySelectorAll("button")).some((button) => button.textContent === "Apply changes"),
    ).toBe(true);
  });
});
