import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlatformPageState } from "./platform-page-state";

describe("PlatformPageState", () => {
  it("distinguishes permission denial from missing content", () => {
    const { rerender } = render(<PlatformPageState kind="forbidden" />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Platform access required",
      }),
    ).toBeInTheDocument();

    rerender(<PlatformPageState kind="not-found" />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Page not found" }),
    ).toBeInTheDocument();
  });

  it("offers recovery for unavailable and unexpected failures", () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <PlatformPageState kind="unavailable" onRetry={onRetry} />,
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Platform administration is unavailable",
      }),
    ).toBeInTheDocument();
    screen.getByRole("button", { name: "Try again" }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(<PlatformPageState kind="error" onRetry={onRetry} />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Platform administration could not load",
      }),
    ).toBeInTheDocument();
  });
});
