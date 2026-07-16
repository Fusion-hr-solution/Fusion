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
  it("renders a clean crumb for platform configuration on the platform route", () => {
    const breadcrumb = renderBreadcrumb("/performance/platform/configuration/performance");

    expect(breadcrumb.textContent).toContain("Performance");
    expect(breadcrumb.textContent).toContain("Platform administration");
    expect(breadcrumb.textContent).toContain("Configuration");
    expect(breadcrumb.textContent).toContain("Performance configuration");
  });

  it("keeps tenant configuration breadcrumb plausible", () => {
    const breadcrumb = renderBreadcrumb("/performance/configuration/planning");

    expect(breadcrumb.textContent).toContain("Performance");
    expect(breadcrumb.textContent).toContain("Configuration");
    expect(breadcrumb.textContent).toContain("Objective Planning");
    expect(breadcrumb.textContent).not.toContain("Platform");
  });

  it("renders campaign create breadcrumb", () => {
    const breadcrumb = renderBreadcrumb("/performance/campaigns/new");

    expect(breadcrumb.textContent).toContain("Performance");
    expect(breadcrumb.textContent).toContain("Campaigns");
    expect(breadcrumb.textContent).toContain("New campaign");
  });

  it("renders campaign draft breadcrumb hierarchy", () => {
    const breadcrumb = renderBreadcrumb("/performance/campaigns/campaign-1");

    expect(breadcrumb.textContent).toContain("Performance");
    expect(breadcrumb.textContent).toContain("Campaigns");
  });

  it("renders planning completion under the campaign breadcrumb hierarchy", () => {
    const breadcrumb = renderBreadcrumb("/performance/campaigns/fy26-planning/completion");

    expect(breadcrumb.textContent).toContain("Performance");
    expect(breadcrumb.textContent).toContain("Campaigns");
    expect(breadcrumb.textContent).toContain("Fy26 planning");
    expect(breadcrumb.textContent).toContain("Planning completion");
  });

  it("renders My objectives workspace breadcrumb hierarchy", () => {
    const breadcrumb = renderBreadcrumb("/performance/my-objectives/fy26-objectives");

    expect(breadcrumb.textContent).toContain("Performance");
    expect(breadcrumb.textContent).toContain("My objectives");
    expect(breadcrumb.textContent).toContain("Fy26 objectives");
  });

  it("renders Plan approvals workspace breadcrumb hierarchy", () => {
    const breadcrumb = renderBreadcrumb("/performance/plan-approvals/fy26-objectives");

    expect(breadcrumb.textContent).toContain("Performance");
    expect(breadcrumb.textContent).toContain("Plan approvals");
    expect(breadcrumb.textContent).toContain("Fy26 objectives");
  });
});
