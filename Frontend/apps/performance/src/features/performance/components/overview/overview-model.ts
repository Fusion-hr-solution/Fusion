import type { OverviewDestinationDto, OverviewSectionDto } from "@repo/api";
import { calibrationHref, objectiveHref, planHref, roundHref, withCycle } from "@/lib/performance-routes";

/**
 * Overview is an attention-and-resume surface served as one projection: the server decides which
 * sections apply (capabilities and recorded responsibility, never a persona) and states their facts.
 * What remains here is where each section resumes — a typed destination turned into a route that keeps
 * the section's Cycle.
 */
export function overviewHref(destination: OverviewDestinationDto): string {
  const cycleId = destination.cycleId;
  switch (destination.workspace) {
    case "MyPlan":
      return withCycle("/plan", cycleId);
    case "Team":
      return withCycle("/team", cycleId);
    case "TeamNeedsReview":
      return withCycle("/team?view=needs-review", cycleId);
    case "CycleAdmin":
      return withCycle("/cycle", cycleId);
    case "CycleSetup":
      return withCycle("/cycle/setup", cycleId);
    case "CycleCreate":
      return withCycle("/cycle/setup/details", cycleId);
    case "OrganizationDirection":
      return withCycle("/goals", cycleId);
    case "Plan":
      return cycleId && destination.planId ? planHref({ cycleId, planId: destination.planId }) : withCycle("/team", cycleId);
    case "Objective":
      return cycleId && destination.objectiveId
        ? objectiveHref({ cycleId, objectiveId: destination.objectiveId })
        : withCycle("/goals", cycleId);
    case "Reviews":
      return withCycle("/reviews", cycleId);
    case "ReviewRound":
      return destination.reviewRoundId ? withCycle(roundHref(destination.reviewRoundId), cycleId) : withCycle("/reviews", cycleId);
    case "Calibration":
      return destination.reviewRoundId ? withCycle(calibrationHref(destination.reviewRoundId), cycleId) : withCycle("/reviews", cycleId);
  }
}

export const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

type SectionOf<K extends OverviewSectionDto["kind"]> = Extract<OverviewSectionDto, { kind: K }>;

/** One rendered block: the team's planning and execution read as one "Your team" section. */
export type OverviewBlock =
  | { kind: "team"; planning: SectionOf<"teamPlanning">; execution?: SectionOf<"teamExecution"> }
  | Exclude<OverviewSectionDto, { kind: "teamPlanning" | "teamExecution" }>;

/** The projection's sections in server order, as the blocks Overview renders. */
export function arrangeOverview(sections: OverviewSectionDto[]): OverviewBlock[] {
  const execution = sections.find((s): s is SectionOf<"teamExecution"> => s.kind === "teamExecution");
  return sections.flatMap((section): OverviewBlock[] => {
    if (section.kind === "teamExecution") return [];
    if (section.kind === "teamPlanning") return [{ kind: "team", planning: section, execution }];
    return [section];
  });
}
