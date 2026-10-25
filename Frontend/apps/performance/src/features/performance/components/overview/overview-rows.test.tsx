// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import type { OverviewRow } from "@repo/api";
import { OwnPlanRow, ReviewsYouWriteRow, TeamRow } from "./overview-rows";
import { YearBand } from "./year-band";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", async () => {
  const React = await import("react");
  return { default: ({ href, children, ...rest }: React.PropsWithChildren<{ href: string }>) => React.createElement("a", { href, ...rest }, children) };
});

const team: OverviewRow<"team"> = {
  kind: "team",
  people: 6,
  objectives: 0,
  plans: { approved: 1, submitted: 1, drafting: 2, notStarted: 2 },
  awaitingDecision: 1,
  firstAwaitingName: "Mariam Gharbi",
  firstAwaitingHref: "/performance/cycles/c/plans/p",
  chips: [
    { employeeId: "m", name: "Mariam Gharbi", state: "Submitted", since: null, needsYou: true, href: "/performance/cycles/c/plans/p" },
    { employeeId: "o", name: "Omar Mansour", state: "Approved", since: null, needsYou: false, href: null },
  ],
  flagged: [],
  flaggedTotal: 0,
  approvedPlans: 1,
  updatedIn30Days: 0,
  withoutRecentUpdate: [],
  withoutRecentUpdateTotal: 0,
  openRequests: 0,
  cycleEnd: "2027-09-30",
  results: null,
};

describe("Overview rows", () => {
  it("leads the team row with the decision waiting, its action opening the plan, and people as chips", () => {
    render(<TeamRow row={team} cycleId="c" />);
    expect(screen.getByText("1 plan waits for your decision")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Review Mariam's plan/ }).getAttribute("href")).toBe("/cycles/c/plans/p");
    expect(screen.getAllByRole("listitem").length).toBe(2);
    expect(screen.getByText("Approved")).toBeTruthy();
  });

  it("shows flagged objectives with the owner's reason", () => {
    render(
      <TeamRow
        row={{
          ...team, awaitingDecision: 0, firstAwaitingHref: null, flaggedTotal: 2, approvedPlans: 6, updatedIn30Days: 5,
          withoutRecentUpdate: ["Nizar Hamdi"], withoutRecentUpdateTotal: 1, openRequests: 1,
          flagged: [
            { objectiveId: "o1", employeeId: "t", personName: "Tarek Ayari", title: "Migrate billing to v2", status: "OffTrack",
              reason: "Vendor API delayed to May", since: "2027-03-02T00:00:00Z", progress: 25, href: "/performance/cycles/c/objectives/o1" },
          ],
        }}
        cycleId="c"
      />,
    );
    expect(screen.getByText("2 objectives are off track or at risk")).toBeTruthy();
    expect(screen.getByText(/"Vendor API delayed to May"/)).toBeTruthy();
    expect(screen.getByText("Nizar Hamdi")).toBeTruthy();
  });

  it("states a draft plan's facts and resumes it", () => {
    const row: OverviewRow<"ownPlan"> = {
      kind: "ownPlan", standing: "Draft", objectives: 2, alignedObjectives: 2, weightTotal: 70, minObjectives: 3, maxObjectives: 5,
      reviewerName: "Mariam Gharbi", submittedAt: null, returnFeedback: null, returnedBy: null, planningDeadline: "2026-10-31",
      planningOpen: true, progress: null, status: null, lastUpdateAt: null, staleObjectives: 0, stalestDays: null, openRequests: 0,
      firstRequestBy: null, firstRequestObjective: null, firstRequestHref: null, href: "/performance/plan?cycle=c",
    };
    render(<OwnPlanRow row={row} />);
    expect(screen.getByText("Your plan is a draft")).toBeTruthy();
    expect(screen.queryByText(/approves it once you submit/)).toBeNull();
    expect(screen.getByText("2 objectives, both aligned")).toBeTruthy();
    expect(screen.getByText("3 to 5 objectives suggested")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Continue your plan/ }).getAttribute("href")).toBe("/plan?cycle=c");
  });

  it("leads the reviews you write with the ready ones", () => {
    render(
      <ReviewsYouWriteRow
        row={{
          kind: "reviewsYouWrite", roundId: "r", roundName: "Year-end review", dueDate: "2027-09-22", total: 6, ready: 2, submitted: 0,
          peerListsToApprove: 1, peerListsDue: "2027-09-15", firstReadyName: "Aicha Bouazizi", firstReadyHref: "/performance/reviews/1",
          chips: [], inCalibration: false,
        }}
      />,
    );
    expect(screen.getByText("2 reviews are ready for you")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Review Aicha/ }).getAttribute("href")).toBe("/reviews/1");
  });

  it("draws the year with today marked and its phases named", () => {
    render(
      <YearBand
        cycleName="FY2027"
        year={{
          state: "Active", start: "2026-10-01", end: "2027-09-30", today: "2026-10-20",
          phases: [
            { name: "Planning", start: "2026-10-01", end: "2026-10-31", state: "Current", estimated: false },
            { name: "Execution", start: "2026-11-01", end: "2027-08-31", state: "Upcoming", estimated: true },
            { name: "Review", start: "2027-09-01", end: "2027-09-30", state: "Upcoming", estimated: true },
          ],
          currentPhase: "Planning", dates: [{ kind: "plans-due", date: "2026-10-31" }], next: { kind: "plans-due", date: "2026-10-31" },
          daysLeft: 11, closedAt: null,
        }}
      />,
    );
    expect(screen.getAllByText("Planning").length).toBeGreaterThan(0);
    expect(screen.getByText("11 days left")).toBeTruthy();
    expect(screen.getByText("Plans due Sat 31 Oct")).toBeTruthy();
    expect(screen.getByText("Today")).toBeTruthy();
  });
});
