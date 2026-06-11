import { describe, expect, it, vi } from "vitest";
import {
  buildOrgChartSearchIndex,
  createOrgChartFlow,
  findEmployeePath,
  flattenOrgChart,
} from "./org-chart-layout";
import type { EmployeeOrgChartNodeDto } from "./org-chart.types";

function createEmployee(
  overrides: Partial<EmployeeOrgChartNodeDto>
): EmployeeOrgChartNodeDto {
  return {
    employeeId: overrides.employeeId ?? crypto.randomUUID(),
    stableEmployeeKey:
      overrides.stableEmployeeKey ?? `E-${crypto.randomUUID().slice(0, 8)}`,
    fullName: overrides.fullName ?? "Employee Name",
    firstName: overrides.firstName ?? "Employee",
    lastName: overrides.lastName ?? "Name",
    email: overrides.email ?? "employee@example.com",
    jobTitle: overrides.jobTitle ?? "Job Title",
    employmentStatus: overrides.employmentStatus ?? "Active",
    orgUnitId: overrides.orgUnitId ?? null,
    orgUnitName: overrides.orgUnitName ?? null,
    managerId: overrides.managerId ?? null,
    managerName: overrides.managerName ?? null,
    hierarchyStatus: overrides.hierarchyStatus ?? "Healthy",
    directReportCount: overrides.directReportCount ?? 0,
    hasChildren: overrides.hasChildren ?? false,
    isOrphaned: overrides.isOrphaned ?? false,
    level: overrides.level ?? 0,
    children: overrides.children ?? [],
    version: overrides.version ?? 1,
  };
}

describe("org-chart-layout", () => {
  const report = createEmployee({
    employeeId: "report-1",
    fullName: "Robin Active",
    firstName: "Robin",
    lastName: "Active",
    email: "robin@example.com",
    managerId: "manager-1",
    managerName: "Alex Manager",
    orgUnitName: "Engineering",
    directReportCount: 0,
    hasChildren: false,
    level: 2,
  });
  const manager = createEmployee({
    employeeId: "manager-1",
    fullName: "Alex Manager",
    firstName: "Alex",
    lastName: "Manager",
    email: "alex@example.com",
    managerId: "root-1",
    managerName: "Emma Executive",
    orgUnitName: "Engineering",
    directReportCount: 1,
    hasChildren: true,
    level: 1,
    children: [report],
  });
  const root = createEmployee({
    employeeId: "root-1",
    fullName: "Emma Executive",
    firstName: "Emma",
    lastName: "Executive",
    email: "emma@example.com",
    orgUnitName: "Leadership",
    directReportCount: 1,
    hasChildren: true,
    level: 0,
    children: [manager],
  });
  const roots = [root];

  it("flattens the org chart and builds a search index", () => {
    const flattened = flattenOrgChart(roots);
    const searchIndex = buildOrgChartSearchIndex(roots);

    expect(flattened).toHaveLength(3);
    expect(searchIndex).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          employeeId: "root-1",
          fullName: "Emma Executive",
        }),
        expect.objectContaining({
          employeeId: "report-1",
          orgUnitName: "Engineering",
        }),
      ])
    );
  });

  it("finds the ancestor path for a nested employee", () => {
    expect(findEmployeePath(roots, "report-1")).toEqual([
      "root-1",
      "manager-1",
      "report-1",
    ]);
  });

  it("creates a visible flow and hides descendants of collapsed nodes", () => {
    const onSelectEmployee = vi.fn();
    const onToggleCollapse = vi.fn();

    const expandedFlow = createOrgChartFlow({
      roots,
      collapsedEmployeeIds: new Set(),
      selectedEmployeeId: "manager-1",
      highlightedEmployeeId: "report-1",
      showJobTitle: true,
      isReassignMode: false,
      dropTargetEmployeeId: null,
      onSelectEmployee,
      onToggleCollapse,
    });

    expect(expandedFlow.nodes).toHaveLength(3);
    expect(expandedFlow.edges).toHaveLength(2);
    expect(
      expandedFlow.nodes.find((node) => node.id === "manager-1")?.data
        .isSelected
    ).toBe(true);
    expect(
      expandedFlow.nodes.find((node) => node.id === "root-1")?.data
        .isOnSelectedPath
    ).toBe(true);
    expect(
      expandedFlow.nodes.find((node) => node.id === "root-1")?.data
        .hasVisibleParent
    ).toBe(false);
    expect(
      expandedFlow.nodes.find((node) => node.id === "manager-1")?.data
        .hasVisibleChildren
    ).toBe(true);
    expect(
      expandedFlow.nodes.find((node) => node.id === "report-1")?.data
        .hasVisibleChildren
    ).toBe(false);
    expect(
      expandedFlow.nodes.find((node) => node.id === "report-1")?.data
        .isHighlighted
    ).toBe(true);
    expect(
      expandedFlow.edges.find((edge) => edge.id === "root-1-manager-1")?.style
        ?.strokeWidth
    ).toBe(2.5);

    const collapsedFlow = createOrgChartFlow({
      roots,
      collapsedEmployeeIds: new Set(["manager-1"]),
      selectedEmployeeId: null,
      highlightedEmployeeId: null,
      showJobTitle: true,
      isReassignMode: false,
      dropTargetEmployeeId: null,
      onSelectEmployee,
      onToggleCollapse,
    });

    expect(collapsedFlow.nodes).toHaveLength(2);
    expect(collapsedFlow.edges).toHaveLength(1);
    expect(
      collapsedFlow.nodes.find((node) => node.id === "manager-1")?.data
        .isCollapsed
    ).toBe(true);
    expect(
      collapsedFlow.nodes.find((node) => node.id === "report-1")
    ).toBeUndefined();
  });
});
