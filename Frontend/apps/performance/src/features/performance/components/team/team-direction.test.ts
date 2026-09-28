import { describe, expect, it } from "vitest";
import type {
  AlignmentTargetDto,
  GoalNodeDto,
  TeamObjectiveWorkspaceItemDto,
} from "@repo/api";
import {
  initialDirectionForTargets,
  visibleTeamObjectives,
} from "./team-objectives-model";

function target(id: string, title: string): AlignmentTargetDto {
  return {
    id,
    ownershipScope: "Company",
    title,
    orgUnitName: null,
    accountablePersonId: "owner-1",
    accountablePersonName: "Owner One",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    directionPath: [title],
  };
}

function node(
  id: string,
  title: string,
  state: "Draft" | "Published",
  endDate: string
): GoalNodeDto {
  return {
    id,
    ownershipScope: "OrgUnit",
    title,
    state,
    parentObjectiveId: null,
    orgUnitId: "team-1",
    orgUnitName: "Talent",
    accountablePersonId: "owner-1",
    accountablePersonName: "Owner One",
    startDate: "2026-01-01",
    endDate,
    progressSource: "Direct",
    measurementSummary: "Manual percentage",
    isAlignmentBaseline: state === "Published",
    isContributionBaselineLocked: false,
    contributionWeightTotal: 0,
    childCount: 0,
    contributorCount: 0,
    contributionToParent: null,
    hasProgress: false,
    derivedProgress: 0,
    progressCoverage: null,
    publishedAt: state === "Published" ? "2026-01-02T00:00:00Z" : null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: null,
  };
}

function item(
  id: string,
  title: string,
  state: "Draft" | "Published",
  endDate: string,
  parent: AlignmentTargetDto | null
): TeamObjectiveWorkspaceItemDto {
  return { node: node(id, title, state, endDate), description: null, parent };
}

describe("Strategic Direction selection", () => {
  it("does not silently select among multiple eligible directions", () => {
    expect(
      initialDirectionForTargets([target("a", "Alpha"), target("b", "Beta")])
    ).toBeNull();
  });

  it("visibly preselects the only eligible direction", () => {
    expect(initialDirectionForTargets([target("b", "Beta")])).toEqual({
      mode: "aligned",
      parentId: "b",
    });
  });

  it("does not invent a direction when none are eligible", () => {
    expect(initialDirectionForTargets([])).toBeNull();
  });
});

describe("Team Objectives portfolio", () => {
  const goalA = target("goal-a", "Goal A");
  const objectives = [
    item("draft-z", "Zeta draft", "Draft", "2026-11-30", goalA),
    item("published-a", "Alpha published", "Published", "2026-06-30", goalA),
    item("standalone", "Standalone work", "Published", "2026-08-31", null),
  ];

  it("keeps every objective in the server-defined default order", () => {
    expect(
      visibleTeamObjectives(objectives, "all", "all", "default").map(
        (entry) => entry.node.id
      )
    ).toEqual(["draft-z", "published-a", "standalone"]);
  });

  it("filters aligned and standalone objectives without choosing a primary objective", () => {
    expect(
      visibleTeamObjectives(objectives, "all", "aligned", "default")
    ).toHaveLength(2);
    expect(
      visibleTeamObjectives(objectives, "all", "standalone", "default").map(
        (entry) => entry.node.id
      )
    ).toEqual(["standalone"]);
  });

  it("sorts by due date only when the manager selects that sort", () => {
    expect(
      visibleTeamObjectives(objectives, "all", "all", "due").map(
        (entry) => entry.node.id
      )
    ).toEqual(["published-a", "standalone", "draft-z"]);
  });
});
