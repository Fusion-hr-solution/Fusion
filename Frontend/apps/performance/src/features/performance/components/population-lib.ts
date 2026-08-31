import type { OrganizationHierarchyNodeDto } from "@repo/api";

export interface OrgUnitState {
  selected: boolean;
  inherited: boolean;
  indeterminate: boolean;
}

/**
 * Truthful per-node selection state for the Population Lens org tree. A unit is `selected` when it is
 * explicitly chosen; `inherited` when an ancestor is chosen with sub-units included (so it is
 * genuinely in the population even though it was never clicked); `indeterminate` when it is not itself
 * in scope but contains a chosen descendant. This is the model that keeps the represented selection
 * equal to the actual backend selection when "Include sub-units" is on.
 */
export function computeOrgStates(
  roots: OrganizationHierarchyNodeDto[],
  selected: Set<string>,
  includeDescendants: boolean
): Map<string, OrgUnitState> {
  const states = new Map<string, OrgUnitState>();
  const walk = (node: OrganizationHierarchyNodeDto, ancestorSelected: boolean): boolean => {
    const id = node.unit.id;
    const isSelected = selected.has(id);
    const inherited = !isSelected && includeDescendants && ancestorSelected;
    let hasSelectedDescendant = false;
    for (const child of node.children) {
      if (walk(child, ancestorSelected || isSelected)) hasSelectedDescendant = true;
    }
    const indeterminate = !isSelected && !inherited && hasSelectedDescendant;
    states.set(id, { selected: isSelected, inherited, indeterminate });
    return isSelected || hasSelectedDescendant;
  };
  roots.forEach((root) => walk(root, false));
  return states;
}
