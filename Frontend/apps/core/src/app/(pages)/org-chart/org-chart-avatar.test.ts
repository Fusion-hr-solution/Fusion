import { describe, expect, it } from "vitest";
import { getAvatarStyle, getInitials } from "./org-chart-avatar";

describe("org-chart-avatar", () => {
  it("derives initials from first and last word", () => {
    expect(getInitials("Emma Executive")).toBe("EE");
    expect(getInitials("  Alex   Middle  Manager ")).toBe("AM");
  });

  it("handles single-word and empty names", () => {
    expect(getInitials("Madonna")).toBe("MA");
    expect(getInitials("")).toBe("?");
    expect(getInitials(null)).toBe("?");
  });

  it("produces a stable, deterministic colour for a given seed", () => {
    const a = getAvatarStyle("E-ABCD1234");
    const b = getAvatarStyle("E-ABCD1234");
    expect(a).toEqual(b);
    expect(a.backgroundColor).toContain("oklch");
    expect(a.color).toContain("oklch");
  });

  it("varies colour by seed", () => {
    expect(getAvatarStyle("E-AAAA").color).not.toBe(
      getAvatarStyle("E-ZZZZ").color
    );
  });
});
