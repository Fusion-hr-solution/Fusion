// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderPerformanceLink } from "./person-page";

describe("renderPerformanceLink", () => {
  it("keeps Performance paths inside the app and sends others to a full navigation", () => {
    render(
      <>
        {renderPerformanceLink({ href: "/performance/reviews/r", children: "Review" })}
        {renderPerformanceLink({ href: "/core/people/EMP-1", children: "Record" })}
      </>,
    );
    // next/link adds the app's basePath at runtime; the route it receives is app-relative.
    expect(screen.getByRole("link", { name: "Review" }).getAttribute("href")).toBe("/reviews/r");
    expect(screen.getByRole("link", { name: "Record" }).getAttribute("href")).toBe("/core/people/EMP-1");
  });
});
