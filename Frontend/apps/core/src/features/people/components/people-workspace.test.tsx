// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PeoplePageDto, PeopleRowDto } from "@repo/api";

const {
  mockPush,
  mockReplace,
  mockSearchParams,
  mockUsePeople,
  mockUseOrg,
  mockUseAuth,
  mockCanManage,
  mockCanImport,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockReplace: vi.fn(),
  mockSearchParams: { current: new URLSearchParams() },
  mockUsePeople: vi.fn(),
  mockUseOrg: vi.fn(() => ({
    data: { roots: [] },
    isLoading: false,
    error: null,
  })),
  mockUseAuth: vi.fn(() => ({
    user: { id: "u1" },
    isAuthenticated: true,
    isLoading: false,
  })),
  mockCanManage: vi.fn(() => true),
  mockCanImport: vi.fn(() => true),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === "string" ? href : String(href)} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => "/people",
  useSearchParams: () => mockSearchParams.current,
}));

vi.mock("@repo/auth", () => ({
  useAuth: () => mockUseAuth(),
  canManageCoreEmployees: () => mockCanManage(),
  canImportCoreEmployees: () => mockCanImport(),
  canManageWorkforceAccess: () => true,
}));

vi.mock("@/features/organization/api/use-organization", () => ({
  useOrganizationHierarchy: () => mockUseOrg(),
}));

vi.mock("../api/use-people", () => ({
  usePeople: () => mockUsePeople(),
}));

import PeopleWorkspace from "./people-workspace";

function row(overrides: Partial<PeopleRowDto> = {}): PeopleRowDto {
  return {
    employeeKey: "E-KEY-1",
    employeeNumber: "E000123",
    displayName: "Ada Lovelace",
    firstName: "Ada",
    lastName: "Lovelace",
    workEmail: "ada@ey-hr.com",
    employmentState: "Active",
    employmentStart: "2022-03-01T00:00:00Z",
    employmentEnd: null,
    work: {
      orgUnitId: null,
      jobTitle: "Principal Engineer",
      organizationName: "Platform",
      organizationPath: "Group / Technology / Platform",
      location: "Tunis",
      effectiveFrom: "2022-03-01T00:00:00Z",
      isHistorical: false,
    },
    primaryManager: {
      employeeKey: "E-KEY-9",
      displayName: "Grace Hopper",
      employeeNumber: "E000001",
    },
    completeness: "Complete",
    ...overrides,
  };
}

function page(items: PeopleRowDto[], totalCount = items.length): PeoplePageDto {
  return {
    items,
    totalCount,
    page: 1,
    pageSize: 25,
    totalPages: Math.max(1, Math.ceil(totalCount / 25)),
  };
}

function queryResult(over: Record<string, unknown>) {
  return {
    data: undefined,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    ...over,
  };
}

beforeEach(() => {
  mockSearchParams.current = new URLSearchParams();
  mockUsePeople.mockReset();
  mockPush.mockReset();
  mockReplace.mockReset();
  mockCanManage.mockReturnValue(true);
  mockCanImport.mockReturnValue(true);
});

afterEach(() => vi.useRealTimers());

describe("PeopleWorkspace", () => {
  it("renders a person row with number, work, manager and employment state", () => {
    mockUsePeople.mockReturnValue(queryResult({ data: page([row()]) }));
    render(<PeopleWorkspace />);

    expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThan(0);
    expect(screen.getAllByText("E000123").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Principal Engineer").length).toBeGreaterThan(0);
    // Organization grammar: the assigned unit is printed; the full path stays quiet as a
    // hover title (dense roster), not a printed ancestry line under every row.
    expect(screen.getAllByText("Platform").length).toBeGreaterThan(0);
    expect(screen.queryByText("Group / Technology")).toBeNull();
    expect(
      screen.getAllByTitle("Group / Technology / Platform").length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Grace Hopper").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    // profile links use the opaque employee key, never a raw id
    const link = screen.getAllByRole("link", { name: "Ada Lovelace" })[0];
    expect(link).toHaveAttribute("href", "/people/E-KEY-1");
  });

  it("shows a true-empty workforce that owns the page, without roster query chrome", () => {
    mockUsePeople.mockReturnValue(queryResult({ data: page([], 0) }));
    render(<PeopleWorkspace />);
    expect(
      screen.getByText("Bring your people into Fusion")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Import workforce/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Add existing employee/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Hire employee/i })
    ).toBeInTheDocument();
    // no dead search/sort chrome when there is nothing to query
    expect(screen.queryByLabelText("Search People")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Sort People")).not.toBeInTheDocument();
    // header must not also duplicate the establishment actions
    expect(
      screen.queryByRole("button", { name: /Add employee/i })
    ).not.toBeInTheDocument();
  });

  it("shows filtered no-results distinctly, with only a clear-filters recovery", () => {
    mockSearchParams.current = new URLSearchParams("q=zzz");
    mockUsePeople.mockReturnValue(queryResult({ data: page([], 0) }));
    render(<PeopleWorkspace />);
    expect(screen.getByText("No matching people")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /Clear filters/i }).length
    ).toBeGreaterThan(0);
    expect(screen.queryByText("No employees yet")).not.toBeInTheDocument();
  });

  it("surfaces a retry affordance on load failure", async () => {
    const refetch = vi.fn();
    mockUsePeople.mockReturnValue(
      queryResult({ error: new Error("Network down"), refetch })
    );
    render(<PeopleWorkspace />);
    expect(screen.getByText("People could not be loaded")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("uses explicit language for scheduled, former and incomplete employment, and no manager", () => {
    mockUsePeople.mockReturnValue(
      queryResult({
        data: page([
          row({
            employeeKey: "E-S",
            displayName: "Sched Person",
            employmentState: "Scheduled",
            employmentStart: "2999-01-01T00:00:00Z",
            primaryManager: null,
          }),
          row({
            employeeKey: "E-F",
            displayName: "Former Person",
            employmentState: "Former",
            employmentEnd: "2020-01-01T00:00:00Z",
          }),
          row({
            employeeKey: "E-I",
            displayName: "Incomplete Person",
            employmentState: "Incomplete",
            work: null,
            primaryManager: null,
          }),
        ]),
      })
    );
    render(<PeopleWorkspace />);
    expect(screen.getAllByText(/Starts/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Ended/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Employment unavailable").length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Work details unavailable").length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("No manager").length).toBeGreaterThan(0);
  });

  it("hides establishment actions when the user cannot manage employees", () => {
    mockCanManage.mockReturnValue(false);
    mockUsePeople.mockReturnValue(queryResult({ data: page([row()]) }));
    render(<PeopleWorkspace />);
    expect(
      screen.queryByRole("button", { name: /Add employee/i })
    ).not.toBeInTheDocument();
  });

  it("debounces search into the URL without a full navigation", () => {
    vi.useFakeTimers();
    mockUsePeople.mockReturnValue(queryResult({ data: page([row()]) }));
    render(<PeopleWorkspace />);
    const input = screen.getByLabelText("Search People");
    fireEvent.change(input, { target: { value: "ada" } });
    expect(mockReplace).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(300));
    expect(mockReplace).toHaveBeenCalled();
    const target = mockReplace.mock.calls.at(-1)?.[0] as string;
    expect(target).toContain("q=ada");
  });
});
