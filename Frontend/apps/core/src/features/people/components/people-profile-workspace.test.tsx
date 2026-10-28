// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  PeopleAccessStatusDto,
  PeopleProfileDto,
  PeopleTimelineDto,
} from "@repo/api";

const {
  mockSearchParams,
  mockProfile,
  mockAccess,
  mockTimeline,
  mockPush,
  mockUpdateWorkEmail,
  mockCanEnterPerformance,
  mockSummary,
} = vi.hoisted(() => ({
  mockCanEnterPerformance: vi.fn(() => true),
  mockSummary: vi.fn(),
  mockSearchParams: { current: new URLSearchParams() },
  mockProfile: vi.fn(),
  mockAccess: vi.fn(),
  mockTimeline: vi.fn(),
  mockPush: vi.fn(),
  mockUpdateWorkEmail: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
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
  useAuth: () => ({
    user: { id: "u1" },
    isAuthenticated: true,
    isLoading: false,
  }),
  canManageCoreEmployees: () => true,
  canManageCoreReporting: () => true,
  canViewWorkforceAccess: () => true,
  canAccessCoreTeam: () => true,
  canAccessCorePeople: () => true,
  canAccessCoreOrgChart: () => true,
  canEnterPerformance: () => mockCanEnterPerformance(),
}));

vi.mock("@repo/api/query", () => ({
  useApiQuery: () => mockSummary(),
  useReactToPraise: () => ({ mutate: vi.fn(), isLoading: false }),
  useCompanyValues: () => ({ data: [] }),
}));

vi.mock("../changes/use-changes", () => ({
  useChangeRights: () => ({ people: true, lines: true, seeComing: true }),
  useChangeMutations: () => ({ dottedLine: { isLoading: false, mutateAsync: vi.fn() } }),
  useCancelChange: () => ({ isLoading: false, mutateAsync: vi.fn() }),
}));

vi.mock("../api/use-people", () => ({
  usePeopleProfile: () => mockProfile(),
  usePeopleAccessStatus: () => mockAccess(),
  usePeopleTimeline: () => mockTimeline(),
  useUpdatePeopleWorkEmail: () => mockUpdateWorkEmail(),
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

      employeeId: "employee-1",
    },
    employment: {
      state: "Active",
      start: "2022-03-01T00:00:00Z",
      end: null,
      employmentType: "Full-time",
    },
    work: {
      orgUnitId: "ORG-1",
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
    directReportCount: 1,
    directReports: [
      {
        employeeKey: "E-KEY-3",
        displayName: "Alan Turing",
        employeeNumber: "E000456",
        jobTitle: "Analyst",
      },
    ],
    completeness: "Complete",
    version: 1,
    viewedDate: "2026-08-18T00:00:00Z",
    isAsOf: false,
    comingUp: [],
    dottedLineManagers: [],
    ...overrides,
  };
}

function q(over: Record<string, unknown>) {
  return {
    data: undefined,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    ...over,
  };
}

function access(
  over: Partial<PeopleAccessStatusDto> = {}
): PeopleAccessStatusDto {
  return { state: "Active", label: "Active", detail: "Employee access", ...over };
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
  mockUpdateWorkEmail.mockReset();
  mockAccess.mockReturnValue(q({ data: access() }));
  mockTimeline.mockReturnValue(q({ data: timeline() }));
  mockUpdateWorkEmail.mockReturnValue({
    isLoading: false,
    mutateAsync: vi.fn(),
  });
});

describe("PeopleProfileWorkspace", () => {
  it("renders the shared worker-profile composition for another worker", () => {
    mockProfile.mockReturnValue(q({ data: profile() }));
    render(<PeopleProfileWorkspace employeeKey="E-KEY-1" />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Ada Lovelace" })
    ).toBeInTheDocument();
    expect(screen.getAllByText("E000123").length).toBeGreaterThan(0);
    // the canonical composition, not the old people-only object page
    expect(screen.getByText("Current assignment")).toBeInTheDocument();
    expect(screen.getByText("Organization & reporting")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Show in org chart/i })).toHaveAttribute("href", "/org-chart?focus=E-KEY-1");
    expect(screen.getByText("Employment")).toBeInTheDocument();
    expect(screen.getByText("Fusion access")).toBeInTheDocument();
    expect(screen.getByText("Work contact")).toBeInTheDocument();
    // one change action opens the change panel; ending employment sits in the menu
    expect(screen.getByRole("button", { name: /Change job/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /More actions/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Change work/i })).not.toBeInTheDocument();
  });

  it("shows a scheduled change inside the hero with Edit and Cancel", () => {
    mockProfile.mockReturnValue(
      q({
        data: profile({
          comingUp: [
            {
              id: "change-1",
              kind: "JobChange",
              effectiveDate: "2099-09-01",
              status: "Scheduled",
              canCancel: true,
              canEdit: true,
              person: { employeeId: "employee-1", employeeKey: "E-KEY-1", displayName: "Ada Lovelace" },
              createdBy: "Amira Khelifi",
              createdAt: "2026-10-26T10:00:00Z",
              note: null,
              details: {
                managerFrom: null, managerTo: null, managerChanged: false,
                unitFromId: "ORG-1", unitFrom: "Platform", unitToId: "ORG-1", unitTo: null,
                titleFrom: "Principal Engineer", titleTo: "Staff Engineer", locationFrom: "Tunis", locationTo: null,
                unitChanged: false, titleChanged: true, locationChanged: false,
                teamOutcome: "Along", teamCount: 1, teamManager: null, reassigned: null, dottedLinesEnded: [],
                lastDay: null, isHire: false, employmentType: null, isReportingOnly: false,
              },
            },
          ],
        }),
      })
    );
    render(<PeopleProfileWorkspace employeeKey="E-KEY-1" />);
    expect(screen.getByText("Becomes Staff Engineer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancel change/i })).toBeInTheDocument();
  });

  it("shows managerless and incomplete-work truth without inventing current facts", () => {
    mockProfile.mockReturnValue(
      q({
        data: profile({
          primaryManager: null,
          directReportCount: 0,
          directReports: [],
          work: null,
          completeness: "WorkDetailsUnavailable",
        }),
      })
    );
    render(<PeopleProfileWorkspace employeeKey="E-KEY-1" />);
    expect(screen.getAllByText(/No manager/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Work details unavailable/i).length
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/Direct reports/i)).not.toBeInTheDocument();
  });

  it("presents a Scheduled worker as a normal lifecycle state with a planned start", () => {
    mockProfile.mockReturnValue(
      q({
        data: profile({
          employment: {
            state: "Scheduled",
            start: "2099-09-15T00:00:00Z",
            end: null,
            employmentType: null,
          },
        }),
      })
    );
    render(<PeopleProfileWorkspace employeeKey="E-KEY-1" />);
    expect(screen.getAllByText("Scheduled").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Starts .*2099/).length).toBeGreaterThan(0);
  });

  it("shows Not set for a missing work email and phone in Work contact", () => {
    mockProfile.mockReturnValue(
      q({
        data: profile({
          identity: {
            employeeKey: "E-KEY-1",
            employeeNumber: "E000123",
            displayName: "Ada Lovelace",
            firstName: "Ada",
            lastName: "Lovelace",
            preferredName: null,
            workEmail: null,
            phone: null,

            employeeId: "employee-1",
          },
        }),
      })
    );
    render(<PeopleProfileWorkspace employeeKey="E-KEY-1" />);
    expect(screen.getByText("Work contact")).toBeInTheDocument();
    expect(screen.getAllByText("Not set").length).toBeGreaterThan(0);
  });

  it("makes a missing work email directly resolvable from the profile", async () => {
    mockProfile.mockReturnValue(
      q({
        data: profile({
          identity: {
            employeeKey: "E-KEY-1",
            employeeNumber: "E000123",
            displayName: "Ada Lovelace",
            firstName: "Ada",
            lastName: "Lovelace",
            preferredName: null,
            workEmail: null,
            phone: null,

            employeeId: "employee-1",
          },
        }),
      })
    );
    mockAccess.mockReturnValue(
      q({
        data: access({
          state: "NoAccess",
          label: "No Fusion access",
          detail: "A work email is required before access can be linked.",
        }),
      })
    );

    render(<PeopleProfileWorkspace employeeKey="E-KEY-1" />);

    expect(
      screen.getAllByRole("button", { name: /Add work email/i })
    ).toHaveLength(2);
    await userEvent.click(
      screen.getAllByRole("button", { name: /Add work email/i })[0]!
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Work email" })).toHaveValue("");
  });

  it.each([
    ["InvitationPending", "Invitation pending", "Review workforce access"],
    ["Active", "Active", "Review workforce access"],
    ["Suspended", "Suspended", "Review workforce access"],
    ["NeedsReview", "Needs review", "Review workforce access"],
    ["NoAccess", "No Fusion access", "Set up workforce access"],
  ])(
    "renders truthful %s Fusion access state",
    (state, label, actionLabel) => {
      mockProfile.mockReturnValue(q({ data: profile() }));
      mockAccess.mockReturnValue(
        q({ data: access({ state, label, detail: "Authoritative detail" }) })
      );

      render(<PeopleProfileWorkspace employeeKey="E-KEY-1" />);

      expect(screen.getByText(label, { selector: "p" })).toBeInTheDocument();
      expect(screen.getByText("Authoritative detail")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: actionLabel })).toBeInTheDocument();
    }
  );

  it("opens the work-email editor from the recovery deep link", () => {
    mockSearchParams.current = new URLSearchParams(
      "action=work-email&returnTo=%2Fcore%2Fworkforce-access"
    );
    mockProfile.mockReturnValue(
      q({
        data: profile({ identity: { ...profile().identity, workEmail: null } }),
      })
    );
    render(<PeopleProfileWorkspace employeeKey="E-KEY-1" />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("loads access state independently and offers retry when it is unavailable", async () => {
    mockProfile.mockReturnValue(q({ data: profile() }));
    const refetch = vi.fn();
    mockAccess.mockReturnValue(
      q({ error: new Error("Identity offline"), refetch })
    );
    render(<PeopleProfileWorkspace employeeKey="E-KEY-1" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Ada Lovelace" })
    ).toBeInTheDocument();
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
    mockProfile.mockReturnValue(
      q({
        data: profile({
          isAsOf: true,
          viewedDate: "2099-09-01T00:00:00Z",
          comingUp: [],
        }),
      })
    );
    render(<PeopleProfileWorkspace employeeKey="E-KEY-1" />);
    expect(screen.getByText(/As of/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Today/i })).toBeInTheDocument();
    // read-only: change actions are hidden on a non-Today snapshot
    expect(
      screen.queryByRole("button", { name: /Change job/i })
    ).not.toBeInTheDocument();
  });

  it("renders a non-disclosing not-found state for unknown or cross-tenant keys", () => {
    mockProfile.mockReturnValue(q({ error: new Error("not found") }));
    render(<PeopleProfileWorkspace employeeKey="E-MISSING" />);
    expect(screen.getByText("Worker not found")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Back to People/i })
    ).toBeInTheDocument();
  });

  it("announces the committed result after establishment", () => {
    mockSearchParams.current = new URLSearchParams("established=hire");
    mockProfile.mockReturnValue(q({ data: profile() }));
    render(<PeopleProfileWorkspace employeeKey="E-KEY-1" />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/Employee hired/i);
  });

  describe("Performance view", () => {
    beforeEach(() => {
      mockCanEnterPerformance.mockReturnValue(true);
      mockProfile.mockReturnValue(q({ data: profile() }));
      mockSummary.mockReturnValue({ data: undefined, error: null, isLoading: true, refetch: vi.fn() });
    });

    it("offers Profile and Performance as sibling views when the viewer can enter Performance", () => {
      render(<PeopleProfileWorkspace employeeKey="E-KEY-1" />);
      const views = screen.getByRole("navigation", { name: "Record views" });
      expect(views).toHaveTextContent("Profile");
      expect(screen.getByRole("link", { name: "Performance" })).toHaveAttribute("href", "/people/E-KEY-1/performance");
      expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("aria-current", "page");
    });

    it("shows no switcher when the tenant or viewer has no Performance", () => {
      mockCanEnterPerformance.mockReturnValue(false);
      render(<PeopleProfileWorkspace employeeKey="E-KEY-1" />);
      expect(screen.queryByRole("navigation", { name: "Record views" })).not.toBeInTheDocument();
    });

    it("shows one line to a colleague who may see no section", () => {
      mockSummary.mockReturnValue({
        data: { employeeId: "employee-1", displayName: "Nour", jobTitle: null, orgUnitName: null, stableEmployeeKey: "E-KEY-1",
          relation: "Other", currentCycle: null, reviews: null },
        error: null,
        isLoading: false,
        refetch: vi.fn(),
      });
      render(<PeopleProfileWorkspace employeeKey="E-KEY-1" view="performance" />);
      expect(screen.getByRole("link", { name: "Performance" })).toHaveAttribute("aria-current", "page");
      expect(screen.getByText("There's nothing you can see here yet.")).toBeInTheDocument();
    });

    it("keeps the record header when Performance fails and offers a retry in place", async () => {
      const refetch = vi.fn();
      mockSummary.mockReturnValue({ data: undefined, error: new Error("down"), isLoading: false, refetch });
      render(<PeopleProfileWorkspace employeeKey="E-KEY-1" view="performance" />);
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
      expect(screen.getByText("Performance couldn't be loaded.")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Try again" }));
      expect(refetch).toHaveBeenCalledOnce();
    });
  });
});
