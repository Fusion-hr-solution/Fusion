import { describe, expect, it } from "vitest";
import {
  buildEmployeeFixHref,
  buildImportHistoryHref,
  getEmployeeActionIssues,
  getEmployeeFixSheet,
  getEmployeeReadinessBadgeLabel,
  parseEmployeeReadinessFilter,
} from "./employee-readiness";

describe("employee readiness helpers", () => {
  it("maps readiness issue targets to profile sheet hrefs", () => {
    const href = buildEmployeeFixHref({
      code: "MissingOrgUnit",
      label: "Org unit is missing",
      severity: "Attention",
      fieldKey: "orgUnitId",
      fixTarget: {
        kind: "ProfileOrganization",
        employeeId: "emp-1",
        fieldKey: "orgUnitId",
      },
    });

    expect(href).toBe("/employees/emp-1?sheet=organization");
  });

  it("maps reporting issues to the reporting sheet", () => {
    const sheet = getEmployeeFixSheet({
      code: "ManagerInactive",
      label: "Assigned manager is inactive",
      severity: "Attention",
      fieldKey: "managerId",
      fixTarget: {
        kind: "ReportingRelationships",
        employeeId: "emp-2",
        fieldKey: "managerId",
      },
    });

    expect(sheet).toBe("reporting");
  });

  it("provides compact badge labels for readiness issues", () => {
    expect(
      getEmployeeReadinessBadgeLabel({
        code: "MissingRequiredField",
        label: "Job title is required",
        severity: "Attention",
        fieldKey: "jobTitle",
        fixTarget: { kind: "ProfileEmployment", employeeId: "emp-1" },
      })
    ).toBe("Missing job title");
  });

  it("keeps deactivation blockers out of general attention issues", () => {
    const issues = getEmployeeActionIssues({
      employeeStateIssueCount: 1,
      blockingIssueCount: 1,
      employeeStateIssues: [
        {
          code: "MissingOrgUnit",
          label: "Org unit is missing",
          severity: "Attention",
          fieldKey: "orgUnitId",
          fixTarget: {
            kind: "ProfileOrganization",
            employeeId: "emp-1",
            fieldKey: "orgUnitId",
          },
        },
      ],
      blockingIssues: [
        {
          code: "DeactivationBlocked",
          label: "Employee has active direct reports",
          severity: "Blocker",
          fieldKey: null,
          fixTarget: {
            kind: "ProfileStatus",
            employeeId: "emp-1",
          },
        },
      ],
      hasEmployeeStateIssues: true,
      hasBlockingIssues: true,
    });

    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe("MissingOrgUnit");
  });

  it("parses supported readiness filters and rejects unknown values", () => {
    expect(parseEmployeeReadinessFilter("ManagerMissing")).toBe(
      "ManagerMissing"
    );
    expect(parseEmployeeReadinessFilter("unknown")).toBeUndefined();
  });

  it("builds import history links with optional history selection", () => {
    expect(buildImportHistoryHref()).toBe(
      "/employees/import#employee-import-history"
    );
    expect(buildImportHistoryHref("hist-1")).toBe(
      "/employees/import?historyId=hist-1#employee-import-history"
    );
  });
});