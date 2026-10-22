// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InsightsDto, InsightsPeopleQuery, InsightsRowDto } from "@repo/api";
import { CycleInsights, personFacts } from "./cycle-insights";

vi.mock("next/link", async () => {
  const React = await import("react");
  return { default: ({ href, children, ...rest }: React.PropsWithChildren<{ href: string }>) => React.createElement("a", { href, ...rest }, children) };
});

const state: { insights: InsightsDto | null; peopleQueries: (InsightsPeopleQuery | null)[] } = { insights: null, peopleQueries: [] };
vi.mock("../../api/use-performance", () => ({
  useInsights: () => ({ data: state.insights, error: null, refetch: () => {} }),
  useInsightsPeople: (_cycleId: string, query: InsightsPeopleQuery | null) => {
    state.peopleQueries.push(query);
    return {
      data: query
        ? {
            metric: query.metric, total: 1, page: 1, pageSize: 25,
            items: [{
              employeeId: "n", name: "Nadia Ferchichi", jobTitle: "Consultant", unitName: "Consulting B", managerName: "Hichem Gharsalli",
              planState: "Approved", lastUpdateAt: null, managerDue: null, managerSubmittedAt: null, releasedAt: "2027-09-28T09:00:00Z",
              acknowledgedAt: null, level: 3, managerLevel: 3, href: "/performance/reviews/r1",
            }],
          }
        : undefined,
      error: null,
    };
  },
}));

const row = (over: Partial<InsightsRowDto>): InsightsRowDto => ({
  unitId: "u", name: "Consulting B", people: 20, plansApproved: 19, approvedPlans: 19, updatedIn30Days: 15,
  status: { onTrack: 50, atRisk: 6, offTrack: 3, noStatus: 10 }, objectives: 69, aligned: 47,
  reviews: null, onTime: null, late: null, released: null, acknowledged: null, levels: null, raised: null, lowered: null, ...over,
});

const execution: InsightsDto = {
  cycleId: "c", cycleName: "FY2027", state: "Active", asOf: "2027-03-16", final: false, participants: 20, unitId: null, scopeName: "Carthage",
  units: [{ unitId: "u", name: "Consulting B", depth: 0 }], showsExecution: true, showsReviews: false, roundId: null, roundName: null,
  managerDue: null, releasedAt: null, neverApproved: 1, withoutRecentUpdate: 4,
  byUnit: [row({})], total: row({ unitId: null, name: "Carthage" }),
  direction: [{ objectiveId: "o", title: "Grow sustainable Tunisian digital capabilities", owner: "Amira Khelifi", alignedObjectives: 47, unitsContributing: 1, units: 1, progress: 52, hasProgress: true }],
  notAligned: 22, byManager: [],
};

const levels = [1, 2, 3, 4, 5].map((value) => ({ value, label: `Level ${value}`, count: value === 3 ? 10 : 2 }));
const released: InsightsDto = {
  ...execution, state: "Closed", final: true, showsReviews: true, roundId: "r", roundName: "Year-end review", managerDue: "2027-09-22",
  releasedAt: "2027-09-28T09:00:00Z",
  byUnit: [row({ reviews: 20, onTime: 9, late: 11, released: 20, acknowledged: 15, levels, raised: 2, lowered: 1 })],
  total: row({ unitId: null, name: "Carthage", reviews: 20, onTime: 9, late: 11, released: 20, acknowledged: 15, levels, raised: 2, lowered: 1 }),
  byManager: [{ employeeId: "h", name: "Hichem Gharsalli", unitName: "Consulting B", people: 20, late: 11, released: 20, acknowledged: 15 }],
};

beforeEach(() => {
  state.peopleQueries = [];
});

describe("Cycle Insights", () => {
  it("shows plans, updates, status and direction during Execution, and no review section", () => {
    state.insights = execution;
    render(<CycleInsights cycleId="c" unitId={null} onUnit={() => {}} />);
    expect(screen.getByText("Updated in the last 30 days", { selector: "p" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Company direction" })).toBeTruthy();
    expect(screen.getByText("Not aligned to any company objective")).toBeTruthy();
    expect(screen.queryByText("Manager reviews on time")).toBeNull();
    expect(screen.queryByRole("region", { name: "By manager" })).toBeNull();
  });

  it("shows reviews, acknowledgement, levels and calibration by unit and by manager once released", () => {
    state.insights = released;
    render(<CycleInsights cycleId="c" unitId={null} onUnit={() => {}} />);
    expect(screen.getByText("Final")).toBeTruthy();
    expect(screen.getByText("Results released")).toBeTruthy();
    expect(screen.getByRole("region", { name: "By manager" })).toBeTruthy();
    expect(screen.getAllByText("11 after Wed 22 Sept")).toHaveLength(2);
    expect(screen.queryByText(/average/i)).toBeNull();
  });

  it("opens the people behind a unit's acknowledgement figure, scoped to that unit", () => {
    state.insights = released;
    render(<CycleInsights cycleId="c" unitId={null} onUnit={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Not acknowledged in Consulting B" }));
    expect(state.peopleQueries.at(-1)).toMatchObject({ metric: "not-acknowledged", unitId: "u", page: 1 });
    expect(screen.getByText("Nadia Ferchichi").closest("a")?.getAttribute("href")).toBe("/reviews/r1");
    expect(screen.getByText("Released Tue 28 Sept")).toBeTruthy();
  });
});

describe("personFacts", () => {
  it("states the calibration change for a rating figure", () => {
    const person = { employeeId: "t", name: "Tarek", jobTitle: null, unitName: null, managerName: null, planState: null, lastUpdateAt: null,
      managerDue: null, managerSubmittedAt: null, releasedAt: null, acknowledgedAt: null, level: 3, managerLevel: 4, href: null };
    expect(personFacts("lowered", person)).toEqual(["4 → 3"]);
  });
});
