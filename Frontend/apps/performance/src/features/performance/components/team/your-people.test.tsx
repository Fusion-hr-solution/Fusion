// @vitest-environment happy-dom
import { render, screen, within } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import type { TeamResultsDto, TeamRosterMemberDto, YourPeoplePageDto } from "@repo/api";
import { DEFAULT_PEOPLE_QUERY, YourPeople, leadAction } from "./your-people";
import { TeamResultsPanel, teamSubtitle } from "./team-summary";
import { formatDate } from "@repo/ds/lib/dates";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/team", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", async () => {
  const React = await import("react");
  return { default: ({ href, children, ...rest }: React.PropsWithChildren<{ href: string }>) => React.createElement("a", { href, ...rest }, children) };
});
vi.mock("../../api/use-review-work", () => ({ useDownloadReviewPdf: () => vi.fn() }));
vi.mock("../update-requests/update-requests", () => ({ RequestUpdateDialog: () => null }));

const member = (over: Partial<TeamRosterMemberDto>): TeamRosterMemberDto => ({
  employeeId: "e",
  employeeName: "Someone",
  jobTitle: "Engineer",
  orgUnitName: "Product A",
  planId: "p",
  status: "Draft",
  hasProgress: false,
  planProgress: 0,
  objectiveProgress: [],
  overdueObjectiveCount: 0,
  activityKind: "None" as TeamRosterMemberDto["activityKind"],
  activityAt: null,
  canReview: false,
  canView: true,
  ...over,
});

const page = (over: Partial<YourPeoplePageDto>): YourPeoplePageDto => ({
  cycleId: "c",
  hasActiveReviewRound: false,
  items: [],
  page: 1,
  pageSize: 25,
  matchCount: 0,
  totalCount: 0,
  counts: { needsReview: 0, planning: 0, approved: 0, noProgress: 0 },
  standing: { people: 0, notStarted: 0, draft: 0, returned: 0, submitted: 0, approved: 0, approvedReporting: 0, peopleWithOverdue: 0, peopleWithoutRecentUpdate: 0, activeLastSevenDays: 0 },
  phase: "Planning",
  groups: [],
  summary: null,
  ...over,
});

const planningFacts = (objectives: number, aligned: number) => ({ planning: { objectives, alignedToTeam: aligned }, execution: null, review: null, closed: null });

describe("Your People", () => {
  it("bands the server's groups in order with their counts, and offers Review plan only where the manager decides", () => {
    const data = page({
      matchCount: 3,
      totalCount: 3,
      groups: [{ key: "waiting", count: 1 }, { key: "planning", count: 1 }, { key: "approved", count: 1 }],
      items: [
        member({ employeeId: "a", employeeName: "Aicha Bouazizi", status: "Submitted", canReview: true, allocatedWeight: 100, group: "waiting", facts: planningFacts(3, 3) }),
        member({ employeeId: "y", employeeName: "Yasmine Trabelsi", status: "Draft", allocatedWeight: 60, group: "planning", facts: planningFacts(2, 2) }),
        member({
          employeeId: "r", employeeName: "Rim Mahjoub", status: "Approved", group: "approved", facts: planningFacts(3, 3),
          objectiveProgress: [40, 30, 30].map((weight) => ({ weight, progress: 0, hasProgress: false, isAligned: true, milestones: [] })),
        }),
      ],
    });
    render(<YourPeople cycleId="c" people={{ data, isLoading: false, error: null, refetch: () => {} }} query={DEFAULT_PEOPLE_QUERY} onQueryChange={() => {}} />);

    const bands = screen.getAllByRole("columnheader").filter((cell) => cell.getAttribute("scope") === "colgroup").map((cell) => cell.textContent);
    expect(bands).toEqual(["Waiting for you · 1", "Still planning · 1", "Approved · 1"]);
    expect(screen.getAllByRole("link", { name: "Review plan" })).toHaveLength(1);
    expect(screen.getAllByText("3 · weights 100%")).toHaveLength(2);
    expect(screen.getByText("2 · weights 60%")).toBeTruthy();
    expect(screen.getAllByText("3 of 3")).toHaveLength(2);
  });

  it("asks the manager to approve proposed peers during a round", () => {
    const data = page({
      phase: "Review",
      hasActiveReviewRound: true,
      matchCount: 1,
      totalCount: 1,
      groups: [{ key: "ready", count: 1 }],
      items: [
        member({
          employeeId: "y", employeeName: "Yasmine Trabelsi", group: "ready", review: { reviewId: "rv", state: "SelfAssessment", dueDate: null },
          facts: {
            planning: null, execution: null, closed: null,
            review: { selfState: "submitted", selfSubmittedAt: "2027-09-11", selfDue: null, peers: { enabled: true, asked: 0, answered: 0, proposed: 3, waitingForYou: true }, yourReview: "notStarted", yourDraftSavedAt: null },
          },
        }),
      ],
    });
    render(<YourPeople cycleId="c" people={{ data, isLoading: false, error: null, refetch: () => {} }} query={DEFAULT_PEOPLE_QUERY} onQueryChange={() => {}} />);
    const row = screen.getByText("Yasmine Trabelsi").closest("tr")!;
    expect(within(row).getByText("3 proposed, waiting for you")).toBeTruthy();
    expect(within(row).getByRole("link", { name: "Approve peers" }).getAttribute("href")).toContain("/reviews?peers=rv");
  });

  it("leads the page with the first plan waiting for a decision", () => {
    const data = page({ items: [member({ employeeName: "Aicha Bouazizi", status: "Submitted", canReview: true, planId: "p1" })] });
    expect(leadAction("c", data)?.label).toBe("Review Aicha’s plan");
    expect(leadAction("c", page({ phase: "Execution" }))).toBeNull();
  });

  it("names the round and its release under the title once closed", () => {
    const summary = {
      status: null, updatedIn30Days: 0, approved: 0, roundName: "Year-end review", selfSubmitted: 0, selfTotal: 0, selfDue: null,
      peerListsToApprove: [], reviewsSubmitted: 0, reviewsReady: 0, reviewsTotal: 0, reviewsDue: null, firstReadyName: null,
      firstReadyReviewId: null, releasedAt: "2027-09-28T09:00:00Z",
    };
    expect(teamSubtitle(page({ phase: "Closed", totalCount: 6, summary }))).toBe(`6 people · Year-end review released ${formatDate("2027-09-28", { weekday: true })}`);
  });
});

describe("Team results", () => {
  const released: TeamResultsDto = {
    cycleId: "c",
    released: 6,
    releasedAt: "2027-09-28T09:00:00Z",
    levels: [
      { value: 1, label: "Below expectations", count: 0, people: [] },
      { value: 2, label: "Developing", count: 1, people: [{ employeeId: "n", name: "Nizar Hamdi" }] },
      { value: 3, label: "Meets expectations", count: 2, people: [{ employeeId: "t", name: "Tarek Ayari" }, { employeeId: "l", name: "Leila Baccouche" }] },
      { value: 4, label: "Exceeds expectations", count: 2, people: [{ employeeId: "a", name: "Aicha Bouazizi" }, { employeeId: "r", name: "Rim Mahjoub" }] },
      { value: 5, label: "Outstanding", count: 1, people: [{ employeeId: "y", name: "Yasmine Trabelsi" }] },
    ],
    acknowledged: 4,
    notAcknowledged: ["Tarek Ayari", "Nizar Hamdi"],
    calibrationChanges: [{ employeeId: "t", name: "Tarek Ayari", from: 4, to: 3 }],
    openGrowthGoals: 9,
  };

  it("shows nothing before release", () => {
    const { container } = render(<TeamResultsPanel results={{ ...released, released: 0, releasedAt: null, levels: [], acknowledged: 0, notAcknowledged: [], calibrationChanges: [], openGrowthGoals: 0 }} />);
    expect(container.innerHTML).toBe("");
  });

  it("counts the team at each level with acknowledgements and calibration changes", () => {
    render(<TeamResultsPanel results={released} />);
    expect(screen.getByText("of 6 acknowledged")).toBeTruthy();
    expect(screen.getByText("Tarek Ayari, 4 → 3")).toBeTruthy();
    expect(screen.getByText("Not yet: Tarek, Nizar")).toBeTruthy();
    expect(screen.getByText("Outstanding")).toBeTruthy();
  });
});
