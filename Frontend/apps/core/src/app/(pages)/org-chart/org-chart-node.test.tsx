// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: {
    Top: "top",
    Bottom: "bottom",
  },
}));

import { OrgChartNode } from "./org-chart-node";

describe("OrgChartNode", () => {
  it("shows a missing org unit badge for structural attention", () => {
    render(
      <OrgChartNode
        id="node-1"
        type="employeeOrgChart"
        dragging={false}
        selected={false}
        zIndex={0}
        selectable={true}
        deletable={false}
        draggable={true}
        isConnectable={false}
        positionAbsoluteX={0}
        positionAbsoluteY={0}
        data={{
          employee: {
            employeeId: "emp-1",
            stableEmployeeKey: "E-EMP1",
            fullName: "Jordan Solo",
            firstName: "Jordan",
            lastName: "Solo",
            email: "jordan.solo@example.com",
            jobTitle: "Analyst",
            employmentStatus: "Active",
            orgUnitId: null,
            orgUnitName: null,
            managerId: null,
            managerName: null,
            hierarchyStatus: "NoManagerAssigned",
            directReportCount: 0,
            hasChildren: false,
            isOrphaned: false,
            level: 0,
            children: [],
            version: 1,
          },
          showJobTitle: true,
          hasVisibleParent: false,
          hasVisibleChildren: false,
          isCollapsed: false,
          isSelected: false,
          isOnSelectedPath: false,
          isInSelectedNeighborhood: false,
          isHighlighted: false,
          isDeemphasized: false,
          isDropTarget: false,
          isReassignMode: false,
          onSelectEmployee: vi.fn(),
          onToggleCollapse: vi.fn(),
        }}
      />
    );

    expect(screen.getByText("No org unit")).toBeTruthy();
  });
});
