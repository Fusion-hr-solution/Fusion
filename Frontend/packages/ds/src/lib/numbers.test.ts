import { describe, expect, it } from "vitest";
import { formatCount, formatNumber, formatPercent } from "./numbers";

describe("numbers", () => {
  it("groups thousands and keeps the fraction asked for", () => {
    expect(formatNumber(1234.567, { maximumFractionDigits: 2 })).toBe("1,234.57");
    expect(formatNumber(1_200_000, { notation: "compact", maximumFractionDigits: 1 })).toBe("1.2m");
  });

  it("writes a ratio as a whole percentage unless told otherwise", () => {
    expect(formatPercent(0.42)).toBe("42%");
    expect(formatPercent(0.425, { maximumFractionDigits: 1 })).toBe("42.5%");
  });

  it("writes French numbers with French grouping and decimals", () => {
    expect(formatNumber(1234.5, undefined, "fr")).toBe("1\u202f234,5");
    expect(formatPercent(0.42, undefined, "fr")).toBe("42\u00a0%");
    expect(formatCount(12345, "fr")).toBe("12\u202f345");
  });

  it("counts in whole, grouped numbers", () => {
    expect(formatCount(12345)).toBe("12,345");
    expect(formatCount(3)).toBe("3");
  });
});
