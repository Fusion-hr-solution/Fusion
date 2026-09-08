import type { GoalNodeDto } from "@repo/api";
import { buildGoalGraph, pathTo, type GoalGraph } from "./goals-lib";

/**
 * Derivation for the single Organization Goals workspace. The page resolves a **working context**
 * — organization-wide, or a specific organizational unit — and this module composes the alignment
 * graph around it. The same grammar serves every actor: what changes is the context, the visible
 * lineage, and the direct parent.
 *
 * The most important rule it enforces is **direct-parent correctness at arbitrary depth**. The
 * prominent upstream direction for any objective is its real immediate parent (company strategic
 * OR another organizational objective), never "the company objective" by assumption. Higher
 * ancestors are preserved as quiet lineage. Pure and side-effect free so this risky composition
 * (which parent leads, sibling suppression, empty vs. established) is unit-testable.
 */

/** The organizational unit the workspace is currently centered on. */
export interface UnitContext {
  orgUnitId: string;
  name: string;
  type?: string | null;
  /** Materialized org path, root→leaf ("Asteria Group / People Operations / Talent Pod"). */
  path?: string | null;
  /** Active headcount of the unit itself (not descendants); null when unknown. */
  memberCount?: number | null;
  /**
   * True only for the actor's own placement (from `/workforce/me`). Enables the possessive
   * "Your team / Your department" framing and the headcount pill. A unit reached by drill-down is
   * never "own" — it is named neutrally.
   */
  isOwnUnit: boolean;
}

/**
 * One upstream → subject → downstream slice of the alignment graph.
 * - `ancestors`: the lineage from the strategic root down to (and including) the direct parent,
 *   ordered root→parent. The LAST entry is the direct parent — the prominent upstream direction.
 *   Empty when `node` is a strategic root (nothing aligns above it).
 * - `node`: the subject objective this block is about.
 * - `children`: objectives aligned directly beneath the subject (downstream, drillable).
 */
export interface ObjectiveBlock {
  ancestors: GoalNodeDto[];
  node: GoalNodeDto;
  children: GoalNodeDto[];
}

/** The unit a focused objective belongs to, named for a neutral (non-possessive) header. */
export interface FocusUnit {
  scope: GoalNodeDto["ownershipScope"];
  name: string;
}

export type WorkspaceComposition =
  /** Company / organization-wide root: published strategic directions and their cascades. */
  | { kind: "organization"; blocks: ObjectiveBlock[] }
  /** A specific objective was drilled into: its upstream, itself, and its children. */
  | { kind: "focused"; unit: FocusUnit; block: ObjectiveBlock }
  /** The actor's own unit, which owns at least one objective. */
  | { kind: "unit"; unit: UnitContext; blocks: ObjectiveBlock[] }
  /** The actor's own unit, which owns nothing yet — the contextual-create state. */
  | {
      kind: "unit-empty";
      unit: UnitContext;
      /** Published directions this unit could align a new objective under; the first is the default. */
      candidates: ObjectiveBlock[];
      hasPublishedDirection: boolean;
    };

export interface ResolveOptions {
  /** The drilled-into objective id, if any. Overrides the default context. */
  focusId?: string | null;
  /** The actor's own organizational placement, if they have one. */
  ownUnit?: UnitContext | null;
  /**
   * Whether the actor's default context is organization-wide (administration / tenant-breadth) rather
   * than their own unit. Authority, not placement, decides this.
   */
  broad: boolean;
}

function byTitle(a: GoalNodeDto, b: GoalNodeDto): number {
  return a.title.localeCompare(b.title);
}

/** The upstream → subject → downstream slice around one objective. */
function blockFor(graph: GoalGraph, node: GoalNodeDto): ObjectiveBlock {
  return {
    ancestors: pathTo(graph, node.id),
    node,
    children: (graph.childrenByParent.get(node.id) ?? []).slice().sort(byTitle),
  };
}

function focusUnitOf(node: GoalNodeDto): FocusUnit {
  if (node.ownershipScope === "OrgUnit") {
    return { scope: "OrgUnit", name: node.orgUnitName ?? "Organizational unit" };
  }
  if (node.ownershipScope === "Employee") {
    return { scope: "Employee", name: node.orgUnitName ?? "Individual objective" };
  }
  return { scope: "Company", name: "Organization-wide" };
}

/** The immediate parent unit's name from a materialized org path, or null when there is no parent segment. */
function immediateParentName(path: string | null | undefined): string | null {
  if (!path) return null;
  const segments = path
    .split(/[/›»>]/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  return segments.length >= 2 ? segments[segments.length - 2]! : null;
}

/**
 * Published directions a new objective for `unit` could align under, best default first. Company
 * strategic baselines are always valid parents. As a best-effort default — never authorization — a
 * deeper unit prefers its immediate parent unit's published objective (matched by the materialized
 * org path, only when unambiguous), so it aligns under organizational direction rather than jumping
 * straight to company strategy. Falls back cleanly to company roots.
 */
function candidateDirections(graph: GoalGraph, unit: UnitContext): GoalNodeDto[] {
  const publishedRoots = graph.roots.filter((root) => root.isAlignmentBaseline);
  const parentName = immediateParentName(unit.path);
  if (parentName) {
    const matches = [...graph.byId.values()].filter(
      (node) =>
        node.ownershipScope === "OrgUnit" &&
        node.isAlignmentBaseline &&
        node.orgUnitName === parentName,
    );
    if (matches.length === 1) {
      const preferred = matches[0]!;
      return [preferred, ...publishedRoots.filter((root) => root.id !== preferred.id)];
    }
  }
  return publishedRoots;
}

export function resolveWorkspace(
  nodes: GoalNodeDto[],
  { focusId, ownUnit, broad }: ResolveOptions,
): WorkspaceComposition {
  const graph = buildGoalGraph(nodes);

  // A drill-down focus wins over the default context (for any actor). A stale focus (the node no
  // longer exists) silently falls through to the default rather than erroring.
  if (focusId) {
    const node = graph.byId.get(focusId);
    if (node) {
      return { kind: "focused", unit: focusUnitOf(node), block: blockFor(graph, node) };
    }
  }

  // A workforce actor is centered on their own unit; authority (not placement) makes an actor broad.
  if (!broad && ownUnit) {
    const unitObjectives = nodes
      .filter((node) => node.ownershipScope === "OrgUnit" && node.orgUnitId === ownUnit.orgUnitId)
      .sort(byTitle);
    if (unitObjectives.length > 0) {
      return { kind: "unit", unit: ownUnit, blocks: unitObjectives.map((node) => blockFor(graph, node)) };
    }
    const candidates = candidateDirections(graph, ownUnit).map((node) => blockFor(graph, node));
    return { kind: "unit-empty", unit: ownUnit, candidates, hasPublishedDirection: candidates.length > 0 };
  }

  // Organization-wide: every strategic root (Draft included, for administration) with its cascade.
  return { kind: "organization", blocks: graph.roots.map((root) => blockFor(graph, root)) };
}

/**
 * The organization's own name — the root of a materialized org path ("Asteria Group / … / Talent
 * Pod"), the top "Organization"-type unit and thus the real company/brand name. Used to attribute a
 * company-scoped strategic objective. Returns null for a bare/single-segment path so the label
 * falls back to the generic "Company strategic objective".
 */
export function rootOrgLabel(path: string | null | undefined): string | null {
  if (!path) return null;
  const segments = path
    .split(/[/›»>]/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  return segments.length >= 2 ? segments[0]! : null;
}
