import { describe, expect, it } from "vitest";
import { ApiError } from "@repo/api";
import {
  fieldForFailure,
  validateDraft,
  type ProvisioningDraft,
} from "./provisioning-form-state";

function draft(overrides: Partial<ProvisioningDraft> = {}): ProvisioningDraft {
  return {
    name: "Acme Tunisia",
    timeZone: "Africa/Tunis",
    locale: "en-US",
    selectedModuleKeys: [],
    administratorEmail: "admin@acme.tn",
    ...overrides,
  };
}

function failure(code: string, status = 400): ApiError {
  return new ApiError(status, "Bad Request", ["Refused."], null, { code }, null);
}

describe("validateDraft", () => {
  it("accepts a complete draft", () => {
    expect(validateDraft(draft())).toEqual({});
  });

  it("reports each unusable field on that field", () => {
    const errors = validateDraft(
      draft({ name: " ", administratorEmail: "not-an-email" })
    );

    expect(errors.name).toBeDefined();
    expect(errors.administratorEmail).toBeDefined();
    expect(errors.timeZone).toBeUndefined();
  });
});

describe("fieldForFailure", () => {
  it("routes a refused request to the control that can resolve it", () => {
    expect(fieldForFailure(failure("provisioning.name_invalid"))).toBe("name");
    expect(fieldForFailure(failure("provisioning.duplicate_name", 409))).toBe("name");
    expect(fieldForFailure(failure("provisioning.time_zone_unsupported"))).toBe(
      "timeZone"
    );
    expect(
      fieldForFailure(failure("provisioning.administrator_email_invalid"))
    ).toBe("administratorEmail");
  });

  it("returns no field when nothing on the form can fix it", () => {
    // A reused idempotency key is not a field problem, so it must be reported
    // at the point of submission instead of blamed on an input.
    expect(fieldForFailure(failure("provisioning.idempotency_conflict", 409))).toBeNull();
    expect(fieldForFailure(new Error("network down"))).toBeNull();
  });
});
