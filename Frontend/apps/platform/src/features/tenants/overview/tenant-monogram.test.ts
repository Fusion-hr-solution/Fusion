import { describe, expect, it } from "vitest";
import { monogramFor } from "./tenant-monogram";
import { pageNumbers } from "./tenant-pagination";

describe("monogramFor", () => {
  it("takes the first and last words of a multi-word name", () => {
    expect(monogramFor("Atlas Group")).toBe("AG");
    expect(monogramFor("Northwind Trading Company")).toBe("NC");
  });

  it("falls back to the first two letters of a single word", () => {
    expect(monogramFor("Zephyr")).toBe("ZE");
  });

  it("splits on the punctuation real company names use", () => {
    expect(monogramFor("Smith & Sons")).toBe("SS");
    expect(monogramFor("Bright-Path")).toBe("BP");
  });

  it("takes the first and last words of a multi-word name", () => {
    expect(monogramFor("Atlas Group")).toBe("AG");
    expect(monogramFor("North Star Logistics Group")).toBe("NG");
  });

  it("stays quiet rather than blank for a name with no letters", () => {
    expect(monogramFor("...")).toBe("—");
  });

  it("handles non-Latin names without dropping to a placeholder", () => {
    expect(monogramFor("مجموعة أطلس")).toHaveLength(2);
  });
});

describe("pageNumbers", () => {
  it("lists every page while they still fit", () => {
    expect(pageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps the first and last page reachable from the middle", () => {
    const pages = pageNumbers(10, 20);

    expect(pages[0]).toBe(1);
    expect(pages[pages.length - 1]).toBe(20);
    expect(pages).toContain(10);
    expect(pages).toContain("gap");
  });

  it("holds a stable width at both ends", () => {
    // The control must not visibly shrink as the operator reaches page 1 or the
    // last page.
    expect(pageNumbers(1, 20).length).toBe(pageNumbers(20, 20).length);
  });

  it("never offers a page outside the result", () => {
    for (const page of [1, 2, 10, 19, 20]) {
      for (const entry of pageNumbers(page, 20)) {
        if (entry !== "gap") {
          expect(entry).toBeGreaterThanOrEqual(1);
          expect(entry).toBeLessThanOrEqual(20);
        }
      }
    }
  });
});
