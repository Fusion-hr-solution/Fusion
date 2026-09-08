import { describe, expect, it } from "vitest";
import type { GoalNodeDto } from "@repo/api";
import { resolveWorkspace, rootOrgLabel, type UnitContext } from "./working-context-lib";

/** Minimal node factory — only the fields the derivation reads. */
function node(partial: Partial<GoalNodeDto> & Pick<GoalNodeDto, "id" | "ownershipScope">): GoalNodeDto {
  return {
    id: partial.id,
    ownershipScope: partial.ownershipScope,
    title: partial.title ?? partial.id,
    state: partial.state ?? "Published",
    parentObjectiveId: partial.parentObjectiveId ?? null,
    orgUnitId: partial.orgUnitId ?? null,
    orgUnitName: partial.orgUnitName ?? null,
    accountablePersonId: partial.accountablePersonId ?? "person-1",
    accountablePersonName: partial.accountablePersonName ?? null,
    startDate: partial.startDate ?? "2026-08-01",
    endDate: partial.endDate ?? "2027-07-31",
    progressSource: partial.progressSource ?? "Direct",
    measurementSummary: partial.measurementSummary ?? "",
    isAlignmentBaseline: partial.isAlignmentBaseline ?? partial.state !== "Draft",
    isContributionBaselineLocked: partial.isContributionBaselineLocked ?? false,
    contributionWeightTotal: partial.contributionWeightTotal ?? 0,
    childCount: partial.childCount ?? 0,
    contributorCount: partial.contributorCount ?? 0,
    contributionToParent: partial.contributionToParent ?? null,
  };
}

const TALENT_POD = "org-talent";
const PEOPLE_OPS = "org-peopleops";
const WORKPLACE_POD = "org-workplace";

const strategic = node({
  id: "strat-1",
  ownershipScope: "Company",
  title: "Improve employee development effectiveness",
  state: "Published",
  isAlignmentBaseline: true,
});

const peopleOpsObjective = node({
  id: "obj-peopleops",
  ownershipScope: "OrgUnit",
  title: "Build a high-performing people organization",
  orgUnitId: PEOPLE_OPS,
  orgUnitName: "People Operations",
  parentObjectiveId: "strat-1",
  state: "Published",
});

function talentUnit(overrides: Partial<UnitContext> = {}): UnitContext {
  return {
    orgUnitId: TALENT_POD,
    name: "Talent Pod",
    type: "Team",
    path: "Asteria Group / People Operations / Talent Pod",
    memberCount: 14,
    isOwnUnit: true,
    ...overrides,
  };
}

describe("resolveWorkspace — organization-wide context", () => {
  it("presents every strategic root with its immediate cascade", () => {
    const result = resolveWorkspace([strategic, peopleOpsObjective], { broad: true });

    expect(result.kind).toBe("organization");
    if (result.kind !== "organization") return;
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]!.node.id).toBe("strat-1");
    expect(result.blocks[0]!.ancestors).toHaveLength(0);
    expect(result.blocks[0]!.children.map((c) => c.id)).toEqual(["obj-peopleops"]);
  });

  it("includes Draft strategic roots (administration sees drafts)", () => {
    const draftStrategic = node({ id: "strat-draft", ownershipScope: "Company", state: "Draft", isAlignmentBaseline: false });
    const result = resolveWorkspace([strategic, draftStrategic], { broad: true });
    expect(result.kind).toBe("organization");
    if (result.kind !== "organization") return;
    expect(result.blocks.map((b) => b.node.id).sort()).toEqual(["strat-1", "strat-draft"]);
  });
});

describe("resolveWorkspace — own-unit context", () => {
  it("shows the empty state with the company direction when the unit owns nothing (first level)", () => {
    const firstLevelUnit = talentUnit({ path: "Asteria Group / Talent Pod" });
    const result = resolveWorkspace([strategic], { broad: false, ownUnit: firstLevelUnit });

    expect(result.kind).toBe("unit-empty");
    if (result.kind !== "unit-empty") return;
    expect(result.hasPublishedDirection).toBe(true);
    expect(result.candidates).toHaveLength(1);
    // Direct parent is the company strategic root (no deeper unit above it).
    expect(result.candidates[0]!.node.id).toBe("strat-1");
    expect(result.candidates[0]!.ancestors).toHaveLength(0);
  });

  it("prefers the parent unit's published objective as the empty-state direction (deeper level)", () => {
    // Talent Pod sits under People Operations, which has a published objective → that is the natural
    // direct parent, not company strategy.
    const result = resolveWorkspace([strategic, peopleOpsObjective], { broad: false, ownUnit: talentUnit() });

    expect(result.kind).toBe("unit-empty");
    if (result.kind !== "unit-empty") return;
    const primary = result.candidates[0]!;
    expect(primary.node.id).toBe("obj-peopleops");
    // Company strategy is preserved as quiet ancestry above the direct parent.
    expect(primary.ancestors.map((a) => a.id)).toEqual(["strat-1"]);
    // Company strategy remains available as an alternative direction.
    expect(result.candidates.map((c) => c.node.id)).toContain("strat-1");
  });

  it("does not attribute a sibling unit's objective to the acting scope", () => {
    const workplaceObjective = node({
      id: "obj-workplace",
      ownershipScope: "OrgUnit",
      orgUnitId: WORKPLACE_POD,
      orgUnitName: "Workplace Pod",
      parentObjectiveId: "strat-1",
      state: "Published",
    });
    const result = resolveWorkspace([strategic, workplaceObjective], { broad: false, ownUnit: talentUnit() });
    expect(result.kind).toBe("unit-empty");
  });

  it("surfaces the unit's own Draft objective with its true direct parent", () => {
    const talentDraft = node({
      id: "obj-talent-draft",
      ownershipScope: "OrgUnit",
      orgUnitId: TALENT_POD,
      orgUnitName: "Talent Pod",
      parentObjectiveId: "obj-peopleops", // aligned under People Operations, not company
      state: "Draft",
      isAlignmentBaseline: false,
    });
    const result = resolveWorkspace([strategic, peopleOpsObjective, talentDraft], {
      broad: false,
      ownUnit: talentUnit(),
    });

    expect(result.kind).toBe("unit");
    if (result.kind !== "unit") return;
    expect(result.blocks).toHaveLength(1);
    const block = result.blocks[0]!;
    expect(block.node.id).toBe("obj-talent-draft");
    // The direct parent (prominent upstream) is People Operations — NOT company strategy.
    expect(block.ancestors.at(-1)!.id).toBe("obj-peopleops");
    // Company strategy is the quiet ancestor above the direct parent.
    expect(block.ancestors.map((a) => a.id)).toEqual(["strat-1", "obj-peopleops"]);
  });
});

describe("resolveWorkspace — drilled focus", () => {
  it("centers a focused objective on its real direct parent and children", () => {
    const talentPublished = node({
      id: "obj-talent",
      ownershipScope: "OrgUnit",
      orgUnitId: TALENT_POD,
      orgUnitName: "Talent Pod",
      parentObjectiveId: "obj-peopleops",
      state: "Published",
      childCount: 1,
    });
    const deeper = node({
      id: "obj-squad",
      ownershipScope: "OrgUnit",
      orgUnitName: "Hiring Squad",
      parentObjectiveId: "obj-talent",
      state: "Published",
    });
    const nodes = [strategic, peopleOpsObjective, talentPublished, deeper];

    const result = resolveWorkspace(nodes, { broad: true, focusId: "obj-talent" });
    expect(result.kind).toBe("focused");
    if (result.kind !== "focused") return;
    expect(result.unit.name).toBe("Talent Pod");
    expect(result.block.node.id).toBe("obj-talent");
    // Direct parent is People Operations; company is quiet ancestry above it.
    expect(result.block.ancestors.map((a) => a.id)).toEqual(["strat-1", "obj-peopleops"]);
    expect(result.block.children.map((c) => c.id)).toEqual(["obj-squad"]);
  });

  it("falls back to the default context when the focused id is stale", () => {
    const result = resolveWorkspace([strategic], { broad: true, focusId: "does-not-exist" });
    expect(result.kind).toBe("organization");
  });
});

describe("rootOrgLabel", () => {
  it("returns the root brand segment of a materialized path", () => {
    expect(rootOrgLabel("Asteria Group / People Operations / Talent Pod")).toBe("Asteria Group");
  });
  it("returns null for a single-segment or empty path", () => {
    expect(rootOrgLabel("Talent Pod")).toBeNull();
    expect(rootOrgLabel(null)).toBeNull();
  });
});
