import { describe, expect, it } from "vitest";
import { computeVisibleDownline, getSpanOfControl } from "./org-chart-metrics";
import type { EmployeeOrgChartNodeDto } from "./org-chart.types";

function emp(
  id: string,
  children: EmployeeOrgChartNodeDto[] = [],
  directReportCount = children.length
): EmployeeOrgChartNodeDto {
  return {
    employeeId: id,
    stableEmployeeKey: `E-${id}`,
    fullName: id,
    firstName: id,
    lastName: id,
    email: `${id}@example.com`,
    jobTitle: null,
    employmentStatus: "Active",
    orgUnitId: null,
    orgUnitName: null,
    managerId: null,
    managerName: null,
    hierarchyStatus: "Healthy",
    directReportCount,
    hasChildren: children.length > 0,
    isOrphaned: false,
    level: 0,
    children,
    version: 1,
  };
}

describe("org-chart-metrics", () => {
  const tree = emp("root", [
    emp("a", [emp("a1"), emp("a2")]),
    emp("b"),
  ]);

  it("counts all visible descendants", () => {
    expect(computeVisibleDownline(tree)).toBe(4);
    expect(computeVisibleDownline(tree.children[0]!)).toBe(2);
    expect(computeVisibleDownline(tree.children[1]!)).toBe(0);
  });

  it("reports direct + visible downline span of control", () => {
    expect(getSpanOfControl(tree)).toEqual({
      directReports: 2,
      visibleDownline: 4,
    });
  });
});
