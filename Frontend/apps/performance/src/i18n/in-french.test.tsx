// @vitest-environment happy-dom
import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { OverviewYearDto } from "@repo/api";
import { formatDate } from "@repo/ds/lib/dates";
import { ObjectiveStatusBadge } from "@repo/performance-ui";
import { renderInFrench, sayInFrench } from "@/test/intl";
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

describe("Performance in French", () => {
  it("says where the year stands in French", () => {
    expect(yearHeadline(planning, "FY2027", sayInFrench("overview.model"), "fr")).toEqual({
      phase: "Planification",
      left: "11 jours restants",
      next: `Échéance des plans\u00a0: ${formatDate("2026-10-31", { weekday: true, locale: "fr" })}`,
    });
    expect(planWord("ReturnedForChanges", sayInFrench("overview.model"))).toBe("Renvoyé");
  });

  it("words plan checks, roster groups and review due dates in French", () => {
    const checks = planChecks({ objectiveCount: 0, weightTotal: 0, weightRemaining: 100, everyObjectiveHasWeight: false, openChangeRequests: 0 } as never, sayInFrench("plan.checks"));
    expect(checks[0]!.label).toBe("Le plan contient au moins un objectif");
    expect(groupLabel("Planning", "waiting", sayInFrench("team.people"))).toBe("En attente de vous");
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(dueIn(today, sayInFrench("reviews.parts"))).toBe("échéance aujourd’hui");
  });

  it("renders a plan badge and a shared status badge in French", () => {
    renderInFrench(
      <>
        <NotStartedBadge />
        <ObjectiveStatusBadge status="OnTrack" />
      </>,
    );
    expect(screen.getByText("Non commencé")).toBeInTheDocument();
    expect(screen.getByText("En bonne voie")).toBeInTheDocument();
  });
});
