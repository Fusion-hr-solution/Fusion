import { describe, expect, it } from "vitest";
import { parseNumeric } from "./lib";

describe("parseNumeric — measurement input validation", () => {
  it("treats an empty string as neither a value nor invalid", () => {
    expect(parseNumeric("")).toEqual({ num: null, invalid: false });
    expect(parseNumeric("   ")).toEqual({ num: null, invalid: false });
  });

  it("parses a plain number", () => {
    expect(parseNumeric("48")).toEqual({ num: 48, invalid: false });
    expect(parseNumeric("45.5")).toEqual({ num: 45.5, invalid: false });
  });

  it("flags non-numeric input as invalid rather than silently clearing it", () => {
    // The "48M" regression: a suffixed number must report invalid so the composer
    // can show inline guidance instead of a silently disabled submit.
    expect(parseNumeric("48M")).toEqual({ num: null, invalid: true });
    expect(parseNumeric("abc")).toEqual({ num: null, invalid: true });
  });
});
