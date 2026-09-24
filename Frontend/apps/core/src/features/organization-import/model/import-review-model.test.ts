import { describe, expect, it } from "vitest";
import type { OrganizationImportIssue, OrganizationImportReview, OrganizationImportReviewNode } from "@repo/api";
import {
  anchorTreeId,
  attentionByNode,
  buildReviewTree,
  deriveReviewIssues,
  flattenReviewTree,
  PLACEHOLDER_ROOT_ID,
  UNPLACED_PARENT_ID,
} from "./import-review-model";

const node = (proposalNodeId: string, overrides: Partial<OrganizationImportReviewNode> = {}): OrganizationImportReviewNode => ({
  proposalNodeId,
  businessCode: proposalNodeId.toUpperCase(),
  businessCodeGenerated: false,
  name: proposalNodeId,
  typeId: "team",
  typeName: "Team",
  parentProposalNodeId: null,
  parentExistingUnitId: null,
  existingOrgUnitId: null,
  classification: "Create",
  isRoot: false,
  depth: 0,
  blockingIssueCount: 0,
  warningCount: 0,
  sourceCells: [],
  candidates: [],
  identityEvidence: [],
  ...overrides,
});

const issue = (overrides: Partial<OrganizationImportIssue> & { code: string }): OrganizationImportIssue => ({
  severity: "Blocker",
  title: overrides.code,
  message: overrides.code,
  proposalNodeId: null,
  relatedNodeIds: [],
  field: null,
  sourceCells: [],
  preferredResolution: null,
  allowedResolutions: [],
  ...overrides,
});

const review = (overrides: Partial<OrganizationImportReview>): OrganizationImportReview => ({
  effectiveDate: "2026-09-01",
  proposalFingerprint: "f",
  decisionRevision: 0,
  readiness: { state: "Ready", canPublish: true, blockingIssueCount: 0, warningCount: 0, createCount: 0, existingCount: 0 },
  summary: { totalUnits: 0, newUnits: 0, existingUnits: 0, conflictUnits: 0, rootCount: 1, countsByType: [] },
  nodes: [],
  anchors: [],
  issues: [],
  resolutions: { introducedRoot: null, acceptedExistingMatches: {}, keepExistingNodeIds: [] },
  ...overrides,
});

describe("buildReviewTree", () => {
  it("hangs proposed units from existing anchors and existing proposal units", () => {
    const tree = buildReviewTree(review({
      anchors: [{ id: "root", name: "Asteria", businessCode: "AST", typeName: "Organization", parentId: null, isRoot: true }],
      nodes: [
        node("ops", { classification: "Existing", existingOrgUnitId: "ops-unit", parentExistingUnitId: "root" }),
        node("team", { parentExistingUnitId: "ops-unit" }),
        node("squad", { parentProposalNodeId: "team" }),
      ],
    }));

    expect(tree.roots).toEqual([anchorTreeId("root")]);
    expect(flattenReviewTree(tree, new Set()).map((row) => [row.node.id, row.depth])).toEqual([
      [anchorTreeId("root"), 0],
      ["ops", 1],
      ["team", 2],
      ["squad", 3],
    ]);
    expect(tree.byId.get("ops")?.isNew).toBe(false);
    expect(tree.byId.get("team")?.isNew).toBe(true);
  });

  it("shows the root a file with several tops still needs, and groups unplaced units", () => {
    const tree = buildReviewTree(review({
      nodes: [node("alpha"), node("beta"), node("orphan")],
      issues: [
        issue({ code: "MultipleRoots", relatedNodeIds: ["alpha", "beta"] }),
        issue({ code: "MissingParent", proposalNodeId: "orphan" }),
      ],
    }));

    expect(tree.roots).toEqual([PLACEHOLDER_ROOT_ID, UNPLACED_PARENT_ID]);
    expect(tree.childrenByParent.get(PLACEHOLDER_ROOT_ID)).toEqual(["alpha", "beta"]);
    expect(tree.childrenByParent.get(UNPLACED_PARENT_ID)).toEqual(["orphan"]);
  });

  it("keeps units caught in a parent loop visible", () => {
    const tree = buildReviewTree(review({
      nodes: [node("a", { parentProposalNodeId: "b" }), node("b", { parentProposalNodeId: "a" })],
    }));

    expect(flattenReviewTree(tree, new Set()).map((row) => row.node.id).sort()).toEqual(["a", "b"]);
  });
});

describe("deriveReviewIssues", () => {
  it("keeps the server's resolution pathways and points issues at their units", () => {
    const issues = deriveReviewIssues(review({
      issues: [
        issue({ code: "DuplicateDisplayName", severity: "Warning", relatedNodeIds: ["a", "b"] }),
        issue({
          code: "MissingParent",
          proposalNodeId: "c",
          preferredResolution: "ReturnToMatch",
          allowedResolutions: ["ReturnToMatch", "CorrectSource"],
        }),
      ],
    }));

    expect(issues.map((item) => item.code)).toEqual(["MissingParent", "DuplicateDisplayName"]);
    expect(issues[0]).toMatchObject({
      anchorNodeId: "c",
      nodeIds: ["c"],
      preferredResolution: "ReturnToMatch",
      allowedResolutions: ["ReturnToMatch", "CorrectSource"],
    });
    expect(issues[1]?.nodeIds).toEqual(["a", "b"]);
    expect(attentionByNode(issues)).toEqual(new Map([["c", "Blocker"], ["a", "Warning"], ["b", "Warning"]]));
  });
});
