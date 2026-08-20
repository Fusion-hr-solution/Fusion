// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PeopleAccessStatusDto, PeopleProfileDto, PeopleTimelineDto } from "@repo/api";

const { mockSearchParams, mockProfile, mockAccess, mockTimeline, mockPush } = vi.hoisted(() => ({
  mockSearchParams: { current: new URLSearchParams() },
  mockProfile: vi.fn(),
  mockAccess: vi.fn(),
  mockTimeline: vi.fn(),
  mockPush: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === "string" ? href : String(href)} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams.current,
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/people/E-KEY-1",
}));

vi.mock("@/shell/breadcrumb-overrides", () => ({
  useBreadcrumbLabel: () => undefined,
}));

vi.mock("@repo/auth", () => ({
  useAuth: () => ({ user: { id: "u1" }, isAuthenticated: true, isLoading: false }),
  canManageCoreEmployees: () => true,
}));

vi.mock("../api/use-people", () => ({
  usePeopleProfile: () => mockProfile(),
  usePeopleAccessStatus: () => mockAccess(),
  usePeopleTimeline: () => mockTimeline(),
}));

import PeopleProfileWorkspace from "./people-profile-workspace";

function profile(overrides: Partial<PeopleProfileDto> = {}): PeopleProfileDto {
  return {
    identity: {
      employeeKey: "E-KEY-1",
      employeeNumber: "E000123",
      displayName: "Ada Lovelace",
      firstName: "Ada",
      lastName: "Lovelace",
      preferredName: null,
      workEmail: "ada@ey-hr.com",
      phone: "+216 00 000 000",
    },
    employment: { state: "Active", start: "2022-03-01T00:00:00Z", end: null, employmentType: "Full-time" },
    work: {
      orgUnitId: "ORG-1",
      jobTitle: "Principal Engineer",
      organizationName: "Platform",
      organizationPath: "Group / Technology / Platform",
      location: "Tunis",
      effectiveFrom: "2022-03-01T00:00:00Z",
      isHistorical: false,
    },
    primaryManager: { employeeKey: "E-KEY-9", displayName: "Grace Hopper", employeeNumber: "E000001" },
    directReportCount: 1,
    directReports: [{ employeeKey: "E-KEY-3", displayName: "Alan Turing", employeeNumber: "E000456", jobTitle: "Analyst" }],
    completeness: "Complete",
    version: 1,
    viewedDate: "2026-08-18T00:00:00Z",
    isAsOf: false,
    upcoming: [],
    ...overrides,
  };
}

function q(over: Record<string, unknown>) {
  return { data: undefined, isLoading: false, error: null, refetch: vi.fn(), ...over };
}

function access(over: Partial<PeopleAccessStatusDto> = {}): PeopleAccessStatusDto {
  return { state: "Linked", label: "Linked", detail: "ada@ey-hr.com", ...over };
}

function timeline(over: Partial<PeopleTimelineDto> = {}): PeopleTimelineDto {
  return { upcoming: [], timeline: [], ...over };
}

beforeEach(() => {
  mockSearchParams.current = new URLSearchParams();
  mockProfile.mockReset();
  mockAccess.mockReset();
  mockTimeline.mockReset();
  mockPush.mockReset();
  mockAccess.mockReturnValue(q({ data: access() }));
  mockTimeline.mockReturnValue(q({ data: timeline() }));
});

describe("PeopleProfileWorkspace", () => {
  it("renders the identity header and one connected workforce summary", () => {
    mockProfile.mockReturnValue(q({ data: profile() }));
    render(<PeopleProfileWorkspace employeeKey="E-KEY-1" />);

    expect(screen.getByRole("heading", { level: 1, name: "Ada Lovelace" })).toBeInTheDocument();
    expect(screen.getAllByText("E000123").length).toBeGreaterThan(0);
    // an asymmetric object page, not a four-card entity dashboard
    expect(screen.getByText("Current work")).toBeInTheDocument();
    expect(screen.getByText("Employment")).toBeInTheDocument();
    expect(screen.getByText("Reporting to")).toBeInTheDocument();
    expect(screen.getByText("Fusion access")).toBeInTheDocument();
    // contextual change actions are present on the Today view for managers
    expect(screen.getByRole("link", { name: /Change work/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Change manager/i })).toBeInTheDocument();
  });

  it("surfaces scheduled upcoming changes with a path to view as of that date", () => {
    mockProfile.mockReturnValue(
      q({
        data: profile({
          upcoming: [
            {
              effectiveDate: "2099-09-01T00:00:00Z",
              kind: "Work",
              employeeKey: "E-KEY-1",
              fields: [{ label: "Title", from: "Principal Engineer", to: "Staff Engineer" }],
            },
          ],
        }),
      }),
    );
    render(<PeopleProfileWorkspace employeeKey="E-KEY-1" />);
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
    expect(screen.getByText("Work change")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /View as of/i })).toBeInTheDocument();
  });

  it("shows managerless and incomplete-work truth without inventing current facts", () => {
    mockProfile.mockReturnValue(
      q({ data: profile({ primaryManager: null, directReportCount: 0, directReports: [], work: null, completeness: "WorkDetailsUnavailable" }) }),
    );
    render(<PeopleProfileWorkspace employeeKey="E-KEY-1" />);
    expect(screen.getAllByText("No manager").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Work details unavailable/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Direct reports/i)).not.toBeInTheDocument();
  });

  it("presents a Scheduled employee as a normal lifecycle state with a planned start", () => {
    mockProfile.mockReturnValue(
      q({ data: profile({ employment: { state: "Scheduled", start: "2099-09-15T00:00:00Z", end: null, employmentType: null } }) }),
    );
    render(<PeopleProfileWorkspace employeeKey="E-KEY-1" />);
    expect(screen.getAllByText("Scheduled").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Starts .*2099/).length).toBeGreaterThan(0);
  });

  it("omits Contact entirely when neither email nor phone is present", () => {
    mockProfile.mockReturnValue(
      q({ data: profile({ identity: { employeeKey: "E-KEY-1", employeeNumber: "E000123", displayName: "Ada Lovelace", firstName: "Ada", lastName: "Lovelace", preferredName: null, workEmail: null, phone: null } }) }),
    );
    render(<PeopleProfileWorkspace employeeKey="E-KEY-1" />);
    expect(screen.queryByText("Contact")).not.toBeInTheDocument();
  });

  it("loads access state independently and offers retry when it is unavailable", async () => {
    mockProfile.mockReturnValue(q({ data: profile() }));
    const refetch = vi.fn();
    mockAccess.mockReturnValue(q({ error: new Error("Identity offline"), refetch }));
    render(<PeopleProfileWorkspace employeeKey="E-KEY-1" />);
    expect(screen.getByRole("heading", { level: 1, name: "Ada Lovelace" })).toBeInTheDocument();
    expect(screen.getByText("Status unavailable")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("lists PrimaryManager-only direct reports", () => {
    mockProfile.mockReturnValue(q({ data: profile() }));
    render(<PeopleProfileWorkspace employeeKey="E-KEY-1" />);
    const report = screen.getByRole("link", { name: /Alan Turing/ });
    expect(report).toHaveAttribute("href", "/people/E-KEY-3");
  });

  it("presents an as-of view as read-only with a return to Today", () => {
    mockSearchParams.current = new URLSearchParams("asOf=2099-09-01");
    mockProfile.mockReturnValue(q({ data: profile({ isAsOf: true, viewedDate: "2099-09-01T00:00:00Z", upcoming: [] }) }));
    render(<PeopleProfileWorkspace employeeKey="E-KEY-1" />);
    expect(screen.getByText(/As of/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Today/i })).toBeInTheDocument();
    // read-only: change actions are hidden on a non-Today snapshot
    expect(screen.queryByRole("link", { name: /Change work/i })).not.toBeInTheDocument();
  });

  it("renders a non-disclosing not-found state for unknown or cross-tenant keys", () => {
    mockProfile.mockReturnValue(q({ error: new Error("not found") }));
    render(<PeopleProfileWorkspace employeeKey="E-MISSING" />);
    expect(screen.getByText("Employee not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to People/i })).toBeInTheDocument();
  });

  it("announces the committed result after establishment", () => {
    mockSearchParams.current = new URLSearchParams("established=hire");
    mockProfile.mockReturnValue(q({ data: profile() }));
    render(<PeopleProfileWorkspace employeeKey="E-KEY-1" />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/Employee hired/i);
  });
});
