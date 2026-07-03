import { describe, expect, it } from "vitest";
import {
  parseWeightValues,
  formatWeightValues,
  parseMeasurementTypes,
  labelMeasurementTypes,
  labelMeasurementType,
  labelCascadeMode,
  policyStatusLabel,
  policyStatusTone,
  templateStatusLabel,
  templateStatusTone,
  baselineStatusLabel,
  applicabilityValidationLabel,
  applicabilityValidationTone,
  formatDate,
  normalizePlatformDefaultsCopy,
} from "./labels";

describe("weight helpers", () => {
  it("parses valid positive weights and drops junk", () => {
    expect(parseWeightValues("5, 10 ,x, 0, -3, 20")).toEqual([5, 10, 20]);
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
    expect(labelMeasurementType("Quantitative")).toBe("Numeric target");
    expect(labelMeasurementType("Qualitative")).toBe("Qualitative outcome");
  });

  it("labels cascade mode without leaking enum names", () => {
    expect(labelCascadeMode("Disabled")).toBe("Not used");
    expect(labelCascadeMode("Optional")).toBe("Optional");
    expect(labelCascadeMode("Required")).toBe("Required");
  });
});

describe("status terminology", () => {
  it("maps policy statuses to product language and tone", () => {
    expect(policyStatusLabel("Active")).toBe("Current policy");
    expect(policyStatusLabel("Superseded")).toBe("Previous version");
    expect(policyStatusTone("Active")).toBe("success");
    expect(policyStatusTone("Superseded")).toBe("muted");
  });

  it("reflects a pending draft over an active template", () => {
    expect(templateStatusLabel("Active", true)).toBe("Changes pending");
    expect(templateStatusLabel("Active", false)).toBe("Active");
    expect(templateStatusTone("Active", true)).toBe("warning");
    expect(templateStatusTone("Active", false)).toBe("success");
  });

  it("maps baseline statuses", () => {
    expect(baselineStatusLabel("Published")).toBe("Applied");
    expect(baselineStatusLabel("Superseded")).toBe("Previous version");
  });
});

describe("applicability validation copy", () => {
  it("only warns for an unresolved reference", () => {
    expect(applicabilityValidationLabel("Valid")).toBe("Audience looks good");
    expect(applicabilityValidationLabel("HasUnresolved")).toBe(
      "A selected organisation value is no longer available",
    );
    expect(applicabilityValidationLabel("NotValidated")).toBe("");
    expect(applicabilityValidationTone("HasUnresolved")).toBe("warning");
  });
});

describe("misc", () => {
  it("renders a placeholder for missing dates", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
  });

  it("normalizes platform-defaults copy to tenant-facing terms", () => {
    expect(normalizePlatformDefaultsCopy("Standard setup exceeds advanced limits")).toBe(
      "Default objective policy exceeds platform limits",
    );
  });
});
