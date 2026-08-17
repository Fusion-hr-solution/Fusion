// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrgPath, formatWorkforceDate, initials } from "./workforce-ui";

describe("formatWorkforceDate", () => {
  it("renders a stored date-only value unambiguously, never as US MM/DD", () => {
    // 2021-02-01 is 1 February — must never read as 'Feb 2' or 'January'
    const value = formatWorkforceDate("2021-02-01");
    expect(value).toMatch(/1/);
    expect(value).toMatch(/Feb/i);
    expect(value).toMatch(/2021/);
    expect(value).not.toMatch(/Jan/i);
    // no slash-delimited numeric ambiguity
    expect(value).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("keeps date semantics stable regardless of the clock/timezone (UTC anchored)", () => {
    expect(formatWorkforceDate("2026-09-15")).toMatch(/15/);
    expect(formatWorkforceDate("2026-09-15")).toMatch(/Sep/i);
  });

  it("accepts full ISO timestamps and empty values", () => {
    expect(formatWorkforceDate("2022-03-01T00:00:00Z")).toMatch(/Mar/i);
    expect(formatWorkforceDate(null)).toBe("");
    expect(formatWorkforceDate(undefined)).toBe("");
  });
});

describe("initials", () => {
  it("derives a deterministic two-letter monogram", () => {
    expect(initials("Youssef Ben Ali")).toBe("YA");
    expect(initials("Ada")).toBe("AD");
    expect(initials("   ")).toBe("—");
  });
});

describe("OrgPath", () => {
  it("shows the assigned unit first and ancestry as quiet context", () => {
    render(<OrgPath name="Platform" path="Group / Technology / Platform" />);
    expect(screen.getByText("Platform")).toBeInTheDocument();
    expect(screen.getByText("Group / Technology")).toBeInTheDocument();
    // the long slash path is not the only presentation
    expect(screen.queryByText("Group / Technology / Platform")).not.toBeInTheDocument();
  });

  it("omits ancestry for a top-level unit", () => {
    render(<OrgPath name="Group" path="Group" />);
    expect(screen.getByText("Group")).toBeInTheDocument();
  });
});
