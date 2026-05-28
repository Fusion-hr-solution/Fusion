import type { DraftOrgUnitDto } from "@repo/api";
import { describe, expect, it } from "vitest";
import type { DraftStructureTreeNodeModel } from "./draft-structure-tree-utils";
import {
  resolveDraftStructureSelectedUnitId,
  shouldShowDraftStructureBootstrap,
} from "./draft-structure-page-state";

function buildNode(
  id: string,
  children: DraftStructureTreeNodeModel[] = []
): DraftStructureTreeNodeModel {
  return {
    id,
    referenceKey: `${id}-ref`,
    displayName: `Node ${id}`,
    orgUnitKindKey: "department",
    orgUnitKindLabel: "Department",
    parentReferenceKey: null,
    location: null,
    description: null,
    attributes: {},
    level: 0,
    rowNumber: null,
    isOrphaned: false,
    issueSummary: {
      errorCount: 0,
      warningCount: 0,
      issues: [],
    },
    children,
  };
}

function buildUnit(id: string): DraftOrgUnitDto {
  return {
    id,
    referenceKey: `${id}-ref`,
    displayName: `Unit ${id}`,
    orgUnitKindKey: "department",
    orgUnitKindLabel: "Department",
    location: null,
    description: null,
    parentId: null,
    parentReferenceKey: null,
    parentDisplayName: null,
    attributes: {},
    createdAt: "2026-05-28T00:00:00Z",
    updatedAt: null,
    version: 1,
  };
}

describe("resolveDraftStructureSelectedUnitId", () => {
  it("falls back to the first tree node when the current selection is missing", () => {
    expect(
      resolveDraftStructureSelectedUnitId({
        draftTree: [buildNode("root-a"), buildNode("root-b")],
        filteredUnits: [buildUnit("root-a"), buildUnit("root-b")],
        isSearching: false,
        selectedUnitId: "missing",
      })
    ).toBe("root-a");
  });

  it("keeps the current selection when it remains visible in search results", () => {
    expect(
      resolveDraftStructureSelectedUnitId({
        draftTree: [buildNode("root-a"), buildNode("root-b")],
        filteredUnits: [buildUnit("root-b")],
        isSearching: true,
        selectedUnitId: "root-b",
      })
    ).toBe("root-b");
  });

  it("falls back to the first filtered unit during search when the current selection disappears", () => {
    expect(
      resolveDraftStructureSelectedUnitId({
        draftTree: [buildNode("root-a"), buildNode("root-b")],
        filteredUnits: [buildUnit("root-b")],
        isSearching: true,
        selectedUnitId: "root-a",
      })
    ).toBe("root-b");
  });

  it("returns null when there is no visible selection candidate", () => {
    expect(
      resolveDraftStructureSelectedUnitId({
        draftTree: [],
        filteredUnits: [],
        isSearching: true,
        selectedUnitId: null,
      })
    ).toBeNull();
  });
});

describe("shouldShowDraftStructureBootstrap", () => {
  it("keeps the bootstrap skeleton up until both workspace and tree are ready", () => {
    expect(
      shouldShowDraftStructureBootstrap({
        workspaceEnabled: true,
        hasWorkspace: true,
        hasTree: false,
        hasWorkspaceError: false,
        hasTreeError: false,
      })
    ).toBe(true);
  });

  it("stops the bootstrap skeleton once both data surfaces are ready", () => {
    expect(
      shouldShowDraftStructureBootstrap({
        workspaceEnabled: true,
        hasWorkspace: true,
        hasTree: true,
        hasWorkspaceError: false,
        hasTreeError: false,
      })
    ).toBe(false);
  });

  it("does not hold the bootstrap skeleton once an error is available", () => {
    expect(
      shouldShowDraftStructureBootstrap({
        workspaceEnabled: true,
        hasWorkspace: false,
        hasTree: false,
        hasWorkspaceError: true,
        hasTreeError: false,
      })
    ).toBe(false);
  });
});