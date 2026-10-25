import { describe, expect, it } from "vitest";
import { valueTone } from "./values";

const catalogue = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("valueTone", () => {
  it("is neutral until the catalogue is known, so a hue never shows and then changes", () => {
    expect(valueTone("b")).toBe(0);
  });

  it("follows the catalogue's order once known", () => {
    expect(valueTone("a", catalogue)).toBe(1);
    expect(valueTone("c", catalogue)).toBe(3);
  });

  it("keeps an archived value on one hue from its id", () => {
    const archived = valueTone("archived-value", catalogue);
    expect(archived).toBeGreaterThan(0);
    expect(valueTone("archived-value", [])).toBe(archived);
  });
});
