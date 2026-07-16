import { describe, expect, it } from "vitest";
import {
  parseWeightValues,
  formatWeightValues,
  parseMeasurementTypes,
  labelMeasurementTypes,
  formatDate,
} from "./labels";

describe("weight helpers", () => {
  it("parses unique whole 5 percent weights and drops invalid values", () => {
    expect(parseWeightValues("5, 10 ,x, 0, -3, 17, 20, 20")).toEqual([5, 10, 20]);
  });

  it("round-trips through format", () => {
    expect(formatWeightValues(parseWeightValues("10,20,30"))).toBe("10,20,30");
  });
});

describe("measurement terminology", () => {
  it("reads a measurement set from CSV", () => {
    expect(parseMeasurementTypes("Quantitative,Qualitative")).toEqual({
      numeric: true,
      qualitative: true,
    });
    expect(parseMeasurementTypes("Qualitative")).toEqual({ numeric: false, qualitative: true });
  });

  it("labels measurement combinations in product language", () => {
    expect(labelMeasurementTypes("Quantitative,Qualitative")).toBe(
      "Numeric targets & qualitative outcomes",
    );
    expect(labelMeasurementTypes("Quantitative")).toBe("Numeric targets only");
    expect(labelMeasurementTypes("")).toBe("—");
  });
});

describe("misc", () => {
  it("renders a placeholder for missing dates", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
  });

});
