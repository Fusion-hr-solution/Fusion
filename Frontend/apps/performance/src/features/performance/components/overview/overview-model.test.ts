import { describe, expect, it } from "vitest";
import type { OverviewYearDto } from "@repo/api";
import { appHref, day, plural, yearHeadline } from "./overview-model";

const planning: OverviewYearDto = {
  state: "Active",
  start: "2026-10-01",
  end: "2027-09-30",
  today: "2026-10-20",
  phases: [
    { name: "Planning", start: "2026-10-01", end: "2026-10-31", state: "Current", estimated: false },
    { name: "Execution", start: "2026-11-01", end: "2027-08-31", state: "Upcoming", estimated: true },
    { name: "Review", start: "2027-09-01", end: "2027-09-30", state: "Upcoming", estimated: true },
  ],
  currentPhase: "Planning",
  dates: [{ kind: "plans-due", date: "2026-10-31" }, { kind: "cycle-end", date: "2027-09-30" }],
  next: { kind: "plans-due", date: "2026-10-31" },
  daysLeft: 11,
  closedAt: null,
};

describe("appHref", () => {
  it("turns server paths into this app's routes and leaves others alone", () => {
    expect(appHref("/performance/reviews/1")).toBe("/reviews/1");
    expect(appHref("/performance/plan?cycle=c")).toBe("/plan?cycle=c");
    expect(appHref("/performance")).toBe("/");
    expect(appHref("/team?cycle=c")).toBe("/team?cycle=c");
  });
});

describe("yearHeadline", () => {
  it("names the phase, the days left and the next date", () => {
    expect(yearHeadline(planning, "FY2027")).toEqual({ phase: "Planning", left: "11 days left", next: "Plans due Sat 31 Oct" });
  });

  it("states a closed cycle without days left", () => {
    expect(yearHeadline({ ...planning, state: "Closed", currentPhase: null, next: null, daysLeft: null, closedAt: "2027-09-30T12:00:00Z" }, "FY2027"))
      .toEqual({ phase: "FY2027 is closed", left: null, next: "Closed Thu 30 Sept" });
  });

  it("leads with late manager reviews once their date has passed", () => {
    const review = { ...planning, dates: [{ kind: "managers-due" as const, date: "2020-09-22", count: 24 }], next: { kind: "cycle-end" as const, date: "2027-09-30" } };
    expect(yearHeadline(review, "FY2027").next).toBe("Manager reviews were due Tue 22 Sept · 24 late");
  });
});

describe("wording", () => {
  it("counts in plain words", () => {
    expect(plural(1, "plan")).toBe("1 plan");
    expect(plural(3, "person", "people")).toBe("3 people");
    expect(day("2026-10-31")).toBe("Sat 31 Oct");
  });
});
