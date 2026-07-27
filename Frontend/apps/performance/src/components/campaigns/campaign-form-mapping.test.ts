import { describe, expect, it } from "vitest";
import {
  emptyObjectiveForm,
  parseWeights,
  toDraftRequest,
  validateDraftForm,
} from "./campaign-form-mapping";

const validForm = {
  name: "Annual review",
  purpose: "",
  referenceYear: 2026,
  planningOpeningDate: "2026-01-01",
  employeeSubmissionDeadline: "2026-02-01",
  managerApprovalDeadline: "2026-03-01",
  expectedPlanningLockDate: "2026-04-01",
};

describe("campaign authoring mapping", () => {
  it("blocks incomplete and out-of-order authoring before a mutation", () => {
    expect(validateDraftForm({ ...validForm, name: "" })).toContain(
      "Campaign name is required.",
    );
    expect(
      validateDraftForm({
        ...validForm,
        managerApprovalDeadline: "2026-01-15",
      }),
    ).toContain("Manager approval cannot be before employee submission.");
  });

  it("preserves the correction form and sends normalized dates", () => {
    expect(toDraftRequest(validForm)).toMatchObject({
      name: "Annual review",
      planningOpeningDate: "2026-01-01T00:00:00.000Z",
    });
    expect(emptyObjectiveForm()).toEqual({
      title: "",
      description: "",
      responsibleFunctionLabel: "",
    });
  });

  it("accepts both stored JSON and legacy comma-separated weights", () => {
    expect(parseWeights("[25,75]")).toEqual(["25%", "75%"]);
    expect(parseWeights("25%, 75")).toEqual(["25%", "75%"]);
  });
});
