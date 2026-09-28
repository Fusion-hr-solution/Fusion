import type {
  AlignmentTargetDto,
  TeamObjectiveWorkspaceItemDto,
} from "@repo/api";
import type { ComposerAlignmentContext } from "../goals/org-composer-host";

export type LifecycleFilter = "all" | "Draft" | "Published";
export type AlignmentFilter = "all" | "aligned" | "standalone";
export type ObjectiveSort = "default" | "due" | "recent" | "title";

export function initialDirectionForTargets(
  targets: AlignmentTargetDto[]
): ComposerAlignmentContext {
  return targets.length === 1
    ? { mode: "aligned", parentId: targets[0]!.id }
    : null;
}

export function visibleTeamObjectives(
  items: TeamObjectiveWorkspaceItemDto[],
  lifecycle: LifecycleFilter,
  alignment: AlignmentFilter,
  sort: ObjectiveSort
): TeamObjectiveWorkspaceItemDto[] {
  const filtered = items.filter(
    (item) =>
      (lifecycle === "all" || item.node.state === lifecycle) &&
      (alignment === "all" ||
        (alignment === "aligned" ? item.parent !== null : item.parent === null))
  );
  if (sort === "default") return filtered;
  return [...filtered].sort((a, b) => {
    if (sort === "due")
      return (
        a.node.endDate.localeCompare(b.node.endDate) ||
        a.node.title.localeCompare(b.node.title)
      );
    if (sort === "recent")
      return (
        (b.node.updatedAt ?? b.node.createdAt).localeCompare(
          a.node.updatedAt ?? a.node.createdAt
        ) || a.node.title.localeCompare(b.node.title)
      );
    return a.node.title.localeCompare(b.node.title);
  });
}
