// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { mockUseEmployeeManagerOptions, mockUseEmployeeOrgUnitOptions } =
  vi.hoisted(() => ({
    mockUseEmployeeManagerOptions: vi.fn(),
    mockUseEmployeeOrgUnitOptions: vi.fn(),
  }));

vi.mock("./use-employees", () => ({
  useEmployeeManagerOptions: mockUseEmployeeManagerOptions,
  useEmployeeOrgUnitOptions: mockUseEmployeeOrgUnitOptions,
}));

import { Toolbar } from "./toolbar";

const baseProps = {
  search: "",
  onSearchChange: vi.fn(),
  status: undefined,
  onStatusChange: vi.fn(),
  orgUnitCode: undefined,
  selectedOrgUnitName: null,
  onOrgUnitChange: vi.fn(),
  orgUnitSeedOptions: [],
  managerId: undefined,
  selectedManagerName: null,
  onManagerChange: vi.fn(),
  managerSeedOptions: [],
  access: undefined,
  onAccessChange: vi.fn(),
  readiness: undefined,
  onReadinessChange: vi.fn(),
  onClearFilters: vi.fn(),
};

describe("Employees Toolbar", () => {
  it("keeps primary filters visible and hides advanced filters by default", async () => {
    const user = userEvent.setup();

    mockUseEmployeeManagerOptions.mockReturnValue({
      data: { items: [] },
    });
    mockUseEmployeeOrgUnitOptions.mockReturnValue({
      data: { items: [] },
    });

    render(<Toolbar {...baseProps} />);

    expect(screen.getByRole("button", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Org unit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Access" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Advanced" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Manager" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Record completeness" })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Advanced" }));

    expect(screen.getByRole("button", { name: "Manager" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Record completeness" })
    ).toBeInTheDocument();
  });

  it("opens the advanced section when a secondary filter is already active", () => {
    mockUseEmployeeManagerOptions.mockReturnValue({
      data: { items: [] },
    });
    mockUseEmployeeOrgUnitOptions.mockReturnValue({
      data: { items: [] },
    });

    render(
      <Toolbar
        {...baseProps}
        managerId="mgr-1"
        selectedManagerName="Morgan Hart"
      />
    );

    expect(screen.getByRole("button", { name: "Morgan Hart" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Record completeness" })
    ).toBeInTheDocument();
  });
});
