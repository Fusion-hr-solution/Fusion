// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PeopleAccessStatusDto, PeopleProfileDto } from "@repo/api";

const { mockSearchParams, mockProfile, mockAccess } = vi.hoisted(() => ({
  mockSearchParams: { current: new URLSearchParams() },
  mockProfile: vi.fn(),
  mockAccess: vi.fn(),
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
}));

vi.mock("@/shell/breadcrumb-overrides", () => ({
  useBreadcrumbLabel: () => undefined,
}));

vi.mock("../api/use-people", () => ({
  usePeopleProfile: () => mockProfile(),
  usePeopleAccessStatus: () => mockAccess(),
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
      jobTitle: "Principal Engineer",
      organizationName: "Platform",
      organizationPath: "Group / Technology / Platform",
      location: "Tunis",
      effectiveFrom: "2022-03-01T00:00:00Z",
      isHistorical: false,
    },
    primaryManager: { employeeKey: "E-KEY-9", displayName: "Grace Hopper", employeeNumber: "E000001" },
    directReportCount: 1,
    directReports: [{ employeeKey: "E-KEY-3", displayName: "Alan Turing", employeeNumber: "E000456" }],
    completeness: "Complete",
    version: 1,
    ...overrides,
  };
}

function q(over: Record<string, unknown>) {
  return { data: undefined, isLoading: false, error: null, refetch: vi.fn(), ...over };
}

function access(over: Partial<PeopleAccessStatusDto> = {}): PeopleAccessStatusDto {
  return { state: "Linked", label: "Linked", detail: "ada@ey-hr.com", ...over };
}

beforeEach(() => {
  mockSearchParams.current = new URLSearchParams();
  mockProfile.mockReset();
  mockAccess.mockReset();
  mockAccess.mockReturnValue(q({ data: access() }));
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
    // no Slice-1-forbidden placeholders
    expect(screen.queryByText(/Timeline/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Upcoming/i)).not.toBeInTheDocument();
  });

  it("shows managerless and incomplete-work truth without inventing current facts", () => {
    mockProfile.mockReturnValue(
      q({ data: profile({ primaryManager: null, directReportCount: 0, directReports: [], work: null, completeness: "WorkDetailsUnavailable" }) }),
    );
    render(<PeopleProfileWorkspace employeeKey="E-KEY-1" />);
    expect(screen.getAllByText("No manager").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Work details unavailable/i).length).toBeGreaterThan(0);
    // zero direct reports is omitted, never shown as a KPI
    expect(screen.queryByText(/Direct reports/i)).not.toBeInTheDocument();
    // empty/non-product facts are not rendered
    expect(screen.queryByText(/Not provided/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Not specified/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Employment type/i)).not.toBeInTheDocument();
  });

  it("presents a Scheduled employee as a normal lifecycle state with a planned start", () => {
    mockProfile.mockReturnValue(
      q({ data: profile({ employment: { state: "Scheduled", start: "2099-09-15T00:00:00Z", end: null, employmentType: null } }) }),
    );
    render(<PeopleProfileWorkspace employeeKey="E-KEY-1" />);
    expect(screen.getAllByText("Scheduled").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Starts .*2099/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Planned start/)).toBeInTheDocument();
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
    // the profile itself still renders even though access failed
    expect(screen.getByRole("heading", { level: 1, name: "Ada Lovelace" })).toBeInTheDocument();
    expect(screen.getByText("Status unavailable")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows the Linked access label from Identity without a link workflow", () => {
    mockProfile.mockReturnValue(q({ data: profile() }));
    mockAccess.mockReturnValue(q({ data: access({ label: "Linked" }) }));
    render(<PeopleProfileWorkspace employeeKey="E-KEY-1" />);
    expect(screen.getAllByText("Linked").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Give access/i })).not.toBeInTheDocument();
  });

  it("lists PrimaryManager-only direct reports", () => {
    mockProfile.mockReturnValue(q({ data: profile() }));
    render(<PeopleProfileWorkspace employeeKey="E-KEY-1" />);
    const report = screen.getByRole("link", { name: /Alan Turing/ });
    expect(report).toHaveAttribute("href", "/people/E-KEY-3");
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
