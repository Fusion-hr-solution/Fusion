import type { DraftOrgUnitDto } from "@repo/api";
import {
  findDraftTreeNodeById,
  getFirstDraftTreeNodeId,
  type DraftStructureTreeNodeModel,
} from "./draft-structure-tree-utils";

interface ResolveDraftStructureSelectedUnitIdArgs {
  draftTree: DraftStructureTreeNodeModel[];
  filteredUnits: DraftOrgUnitDto[];
  isSearching: boolean;
  selectedUnitId: string | null;
}

interface ShouldShowDraftStructureBootstrapArgs {
  workspaceEnabled: boolean;
  hasWorkspace: boolean;
  hasTree: boolean;
  hasWorkspaceError: boolean;
  hasTreeError: boolean;
  isSetupTransitionPending: boolean;
}

export function resolveDraftStructureSelectedUnitId({
  draftTree,
  filteredUnits,
  isSearching,
  selectedUnitId,
}: ResolveDraftStructureSelectedUnitIdArgs) {
  if (isSearching) {
    if (selectedUnitId && filteredUnits.some((unit) => unit.id === selectedUnitId)) {
      return selectedUnitId;
    }

    return filteredUnits[0]?.id ?? null;
  }

  if (selectedUnitId && findDraftTreeNodeById(draftTree, selectedUnitId)) {
    return selectedUnitId;
  }

  return getFirstDraftTreeNodeId(draftTree);
}

export function shouldShowDraftStructureBootstrap({
  workspaceEnabled,
  hasWorkspace,
  hasTree,
  hasWorkspaceError,
  hasTreeError,
  isSetupTransitionPending,
}: ShouldShowDraftStructureBootstrapArgs) {
  return (
    isSetupTransitionPending ||
    workspaceEnabled &&
    !hasWorkspaceError &&
    !hasTreeError &&
    (!hasWorkspace || !hasTree)
  );
}