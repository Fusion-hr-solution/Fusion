import type { AlignmentMapDto, AlignmentMapNodeDto, ObjectiveStatus, PersonalAlignmentDto } from "@repo/api";
import { english, type Say } from "@/i18n/say";

/**
 * The alignment map as a tree the chart can lay out: published direction (company → units at any
 * depth), and under each objective the personal objectives the viewer may open. Pure, so expansion,
 * focus and accessible names are testable without React Flow.
 */
export interface AlignmentMapModel {
  byId: Map<string, AlignmentMapNodeDto>;
  /** Company objectives, in server order. */
  roots: string[];
  /** Direction children (unit objectives) per objective. */
  children: Map<string, string[]>;
  /** Readable personal objectives per direction objective. */
  personal: Map<string, string[]>;
}

export function buildAlignmentMap(dto: AlignmentMapDto): AlignmentMapModel {
  const byId = new Map(dto.nodes.map((node) => [node.id, node]));
  const roots: string[] = [];
  const children = new Map<string, string[]>();
  const personal = new Map<string, string[]>();
  for (const node of dto.nodes) {
    if (node.kind === "Personal") {
      if (node.parentId && byId.has(node.parentId)) push(personal, node.parentId, node.id);
      continue;
    }
    if (node.parentId && byId.has(node.parentId)) push(children, node.parentId, node.id);
    else if (node.kind === "Company") roots.push(node.id);
  }
  return { byId, roots, children, personal };
}

function push(map: Map<string, string[]>, key: string, value: string) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/** Company objectives and their direct unit objectives open; anything deeper starts collapsed. */
export function defaultExpanded(model: AlignmentMapModel): Set<string> {
  const expanded = new Set<string>();
  for (const root of model.roots) {
    expanded.add(root);
    for (const child of model.children.get(root) ?? []) expanded.add(child);
  }
  return expanded;
}

/** The direction objective that holds `id` on the map: itself, or the parent of a personal objective. */
export function directionAnchor(model: AlignmentMapModel, id: string): string | null {
  const node = model.byId.get(id);
  if (!node) return null;
  return node.kind === "Personal" ? node.parentId : node.id;
}

/**
 * What must open for `focusId` to be visible: every ancestor expanded, and, for a personal
 * objective, its parent's personal objectives shown.
 */
export function focusPath(model: AlignmentMapModel, focusId: string): { expand: string[]; openPersonal: string | null } {
  const node = model.byId.get(focusId);
  if (!node) return { expand: [], openPersonal: null };
  const expand: string[] = [];
  // The anchor itself stays as it is; only what is above it opens.
  const anchor = node.kind === "Personal" ? model.byId.get(node.parentId ?? "") : node;
  let current = anchor?.parentId ? model.byId.get(anchor.parentId) : undefined;
  const guard = new Set<string>();
  while (current && !guard.has(current.id)) {
    guard.add(current.id);
    expand.push(current.id);
    current = current.parentId ? model.byId.get(current.parentId) : undefined;
  }
  return { expand, openPersonal: node.kind === "Personal" ? node.parentId : null };
}

export type MapVisibleNode =
  | { kind: "direction"; id: string; hiddenCount: number; expanded: boolean; hasChildren: boolean; personalOpen: boolean }
  | { kind: "personal"; id: string }
  /** The personal objectives under `parentId` that the viewer cannot open. */
  | { kind: "hidden"; id: string; parentId: string; count: number };

export interface MapVisible {
  nodes: MapVisibleNode[];
  edges: Array<{ source: string; target: string; personal: boolean }>;
}

export const hiddenNodeId = (parentId: string) => `hidden:${parentId}`;

/** The nodes and edges on screen for the current expansion. */
export function visibleMap(model: AlignmentMapModel, expanded: ReadonlySet<string>, openPersonal: ReadonlySet<string>): MapVisible {
  const nodes: MapVisibleNode[] = [];
  const edges: MapVisible["edges"] = [];
  const visit = (id: string) => {
    const kids = model.children.get(id) ?? [];
    const isExpanded = expanded.has(id);
    const personalOpen = openPersonal.has(id);
    nodes.push({
      kind: "direction",
      id,
      hasChildren: kids.length > 0,
      expanded: isExpanded,
      hiddenCount: isExpanded ? 0 : descendantCount(model, id),
      personalOpen,
    });
    if (personalOpen) {
      for (const personalId of model.personal.get(id) ?? []) {
        nodes.push({ kind: "personal", id: personalId });
        edges.push({ source: id, target: personalId, personal: true });
      }
      const counts = model.byId.get(id)?.personal;
      const hidden = counts ? counts.total - counts.readable : 0;
      if (hidden > 0) {
        nodes.push({ kind: "hidden", id: hiddenNodeId(id), parentId: id, count: hidden });
        edges.push({ source: id, target: hiddenNodeId(id), personal: true });
      }
    }
    if (!isExpanded) return;
    for (const child of kids) {
      edges.push({ source: id, target: child, personal: false });
      visit(child);
    }
  };
  for (const root of model.roots) visit(root);
  return { nodes, edges };
}

function descendantCount(model: AlignmentMapModel, id: string): number {
  let count = 0;
  for (const child of model.children.get(id) ?? []) count += 1 + descendantCount(model, child);
  return count;
}

/** Unreported is never "on track" (D-05): the map says so in the words the rest of Performance uses. */
const en = english("goals.map");

export function statusLabel(status: ObjectiveStatus | null, say: Say = en): string {
  return status ? say(`status.${status}`) : say("notReported");
}

export function progressLabel(node: Pick<AlignmentMapNodeDto, "hasProgress" | "progress">, say: Say = en): string {
  return node.hasProgress ? say("percent", { value: Math.round(node.progress) }) : say("noProgress");
}

export function scopeLabel(node: AlignmentMapNodeDto, say: Say = en): string {
  if (node.kind === "Company") return say("company");
  if (node.kind === "Personal") return node.isOwn ? say("yourObjective") : (node.ownerName ?? say("personalObjective"));
  return node.orgUnitName ?? say("unit");
}

/** What a screen reader hears for a node: "Talent Pod objective, Grow talent, At risk, 40%". */
export function nodeAccessibleName(node: AlignmentMapNodeDto, say: Say = en): string {
  const scope = node.kind === "Company" ? say("companyObjective") : node.kind === "Personal" ? scopeLabel(node, say) : say("unitObjective", { scope: scopeLabel(node, say) });
  return say("accessible", { scope, title: node.title, status: statusLabel(node.status, say), progress: progressLabel(node, say) });
}

/** "6 personal objectives: 4 on track, 1 at risk, 1 not reported". */
export function personalSummary(counts: PersonalAlignmentDto, say: Say = en): string {
  const parts = [
    counts.onTrack ? say("onTrack", { count: counts.onTrack }) : null,
    counts.atRisk ? say("atRisk", { count: counts.atRisk }) : null,
    counts.offTrack ? say("offTrack", { count: counts.offTrack }) : null,
    counts.noStatus ? say("noStatus", { count: counts.noStatus }) : null,
  ].filter(Boolean);
  return parts.length ? say("personalWithParts", { count: counts.total, parts: parts.join(", ") }) : say("personal", { count: counts.total });
}
