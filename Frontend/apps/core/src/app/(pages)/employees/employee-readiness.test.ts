import { describe, expect, it } from "vitest";
import {
  buildEmployeeFixHref,
  buildImportHistoryHref,
  getEmployeeActionIssues,
  getEmployeeFixSheet,
  getEmployeeReadinessBadgeLabel,
  getEmployeeReadinessStateMeta,
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
        employeeKey: "E-EMP1",
        fieldKey: "orgUnitId",
      },
    });

    expect(href).toBe("/employees/E-EMP1?sheet=organization");
  });

  it("does not fall back to raw employee ids for profile sheet hrefs", () => {
    const href = buildEmployeeFixHref({
      code: "MissingOrgUnit",
      label: "Org unit is missing",
      severity: "Attention",
      fieldKey: "orgUnitId",
      fixTarget: {
        kind: "ProfileOrganization",
        employeeId: "0f1b3dad-7b0b-4ca1-b3f4-8fbf9068b5f0",
        fieldKey: "orgUnitId",
      },
    });

    expect(href).toBeNull();
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
    expect(parseEmployeeReadinessFilter("Ready")).toBe("Ready");
    expect(parseEmployeeReadinessFilter("ManagerMissing")).toBe("ReportingIssue");
    expect(parseEmployeeReadinessFilter("DeactivationBlocked")).toBe(
      "DeactivationBlocked"
    );
    expect(parseEmployeeReadinessFilter("unknown")).toBeUndefined();
  });

  it("maps readiness summaries to cohesive row-state labels", () => {
    expect(getEmployeeReadinessStateMeta(undefined)).toEqual({
      label: "Ready",
      variant: "outline",
    });

    expect(
      getEmployeeReadinessStateMeta({
        employeeStateIssueCount: 1,
        blockingIssueCount: 0,
        employeeStateIssues: [
          {
            code: "MissingRequiredField",
            label: "Job title is required",
            severity: "Attention",
            fieldKey: "jobTitle",
            fixTarget: {
              kind: "ProfileEmployment",
              employeeId: "emp-1",
              fieldKey: "jobTitle",
            },
          },
        ],
        blockingIssues: [],
        hasEmployeeStateIssues: true,
        hasBlockingIssues: false,
      })
    ).toEqual({
      label: "Missing required info",
      variant: "secondary",
    });

    expect(
      getEmployeeReadinessStateMeta({
        employeeStateIssueCount: 1,
        blockingIssueCount: 0,
        employeeStateIssues: [
          {
            code: "ManagerMissing",
            label: "Manager record is missing",
            severity: "Attention",
            fieldKey: "managerId",
            fixTarget: {
              kind: "ReportingRelationships",
              employeeId: "emp-2",
              fieldKey: "managerId",
            },
          },
        ],
        blockingIssues: [],
        hasEmployeeStateIssues: true,
        hasBlockingIssues: false,
      })
    ).toEqual({
      label: "Manager missing",
      variant: "destructive",
    });

    expect(
      getEmployeeReadinessStateMeta({
        employeeStateIssueCount: 0,
        blockingIssueCount: 1,
        employeeStateIssues: [],
        blockingIssues: [
          {
            code: "DeactivationBlocked",
            label: "Employee has active direct reports",
            severity: "Blocker",
            fieldKey: null,
            fixTarget: {
              kind: "ProfileStatus",
              employeeId: "emp-3",
            },
          },
        ],
        hasEmployeeStateIssues: false,
        hasBlockingIssues: true,
      })
    ).toEqual({
      label: "Has direct reports",
      variant: "outline",
    });
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
