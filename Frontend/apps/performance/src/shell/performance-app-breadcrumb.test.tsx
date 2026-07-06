// @vitest-environment happy-dom

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PerformanceAppBreadcrumb } from "./performance-app-breadcrumb";

const navState = vi.hoisted(() => ({
  pathname: "/performance",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navState.pathname,
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
  }
  root = null;
  container = null;
  navState.pathname = "/performance";
});

function renderBreadcrumb(pathname: string) {
  navState.pathname = pathname;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<PerformanceAppBreadcrumb />));
  return container;
}

describe("PerformanceAppBreadcrumb", () => {
  it("renders a clean crumb for platform configuration without platform terminology", () => {
    const breadcrumb = renderBreadcrumb("/performance/configuration/performance");

    expect(breadcrumb.textContent).toContain("Performance");
    expect(breadcrumb.textContent).toContain("Configuration");
    expect(breadcrumb.textContent).toContain("Performance configuration");
    expect(breadcrumb.textContent).not.toContain("Platform");
  });

  it("keeps tenant configuration breadcrumb plausible", () => {
    const breadcrumb = renderBreadcrumb("/performance/configuration/planning");

    expect(breadcrumb.textContent).toContain("Performance");
    expect(breadcrumb.textContent).toContain("Configuration");
    expect(breadcrumb.textContent).toContain("Objective Planning");
    expect(breadcrumb.textContent).not.toContain("Platform");
  });
});
