// @vitest-environment happy-dom
import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { OverviewYearDto } from "@repo/api";
import { ObjectiveStatusBadge } from "@repo/performance-ui";
import { renderInArabic, sayInArabic } from "@/test/intl";
import { planWord, yearHeadline } from "@/features/performance/components/overview/overview-model";
import { NotStartedBadge } from "@/features/performance/components/plan/plan-header";
import { planChecks } from "@/features/performance/components/plan/plan-lib";
import { groupLabel } from "@/features/performance/components/team/your-people";
import { dueIn } from "@/features/performance/components/reviews/review-parts";

const planning: OverviewYearDto = {
  state: "Active",
  start: "2026-10-01",
  end: "2027-09-30",
  today: "2026-10-20",
  phases: [{ name: "Planning", start: "2026-10-01", end: "2026-10-31", state: "Current", estimated: false }],
  currentPhase: "Planning",
  dates: [{ kind: "plans-due", date: "2026-10-31" }],
  next: { kind: "plans-due", date: "2026-10-31" },
  daysLeft: 11,
  closedAt: null,
};

describe("Performance in Arabic", () => {
  it("says where the year stands in Arabic", () => {
    const headline = yearHeadline(planning, "FY2027", sayInArabic("overview.model"), "ar");
    expect(headline.phase).toBe("التخطيط");
    expect(headline.left).toBe("يتبقى 11 أيام");
    expect(headline.next).toMatch(/^موعد الخطط /);
    expect(planWord("ReturnedForChanges", sayInArabic("overview.model"))).toBe("أُعيدت");
  });

  it("words plan checks, roster groups and review due dates in Arabic", () => {
    const checks = planChecks({ objectiveCount: 0, weightTotal: 0, weightRemaining: 100, everyObjectiveHasWeight: false, openChangeRequests: 0 } as never, sayInArabic("plan.checks"));
    expect(checks[0]!.label).toBe("تحتوي الخطة على هدف واحد على الأقل");
    expect(groupLabel("Planning", "waiting", sayInArabic("team.people"))).toBe("بانتظارك");
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(dueIn(today, sayInArabic("reviews.parts"))).toBe("مستحق اليوم");
  });

  it("renders a plan badge and a shared status badge in Arabic", () => {
    renderInArabic(
      <>
        <NotStartedBadge />
        <ObjectiveStatusBadge status="OnTrack" />
      </>,
    );
    expect(screen.getByText("لم تبدأ")).toBeInTheDocument();
    expect(screen.getByText("على المسار")).toBeInTheDocument();
  });
});
