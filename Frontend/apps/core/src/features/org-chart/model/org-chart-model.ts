import type { OrgChartChangeDto, OrgChartDto, OrgChartOpenRoleDto, OrgChartPersonDto } from "@repo/api";

// The people org chart's model, ported from the accepted B-126 card canvas (direction C): one card per person;
// leaders get a portrait card with their team's faces, individual contributors sit in two columns on a spine
// under their manager, sub-teams branch below on a bus, lines turn with soft corners.

export type OrgView = "focus" | "company";
export type LensKey = "division" | "location" | "tenure" | "span" | "none";
/** Tenure and Span of control read HR-only facts (the full start date, everyone's team size). */
export const HR_LENSES: LensKey[] = ["tenure", "span"];

/** Placeholder child that stands for people outside the viewer's slice (DirectReports scope). */
const MORE = "more:";
export const moreId = (parentKey: string) => `${MORE}${parentKey}`;
export const isMore = (id: string) => id.startsWith(MORE);

/** An open role: a dashed Hiring card in its manager's line, after the people. */
const ROLE = "role:";
export const roleId = (id: string) => `${ROLE}${id}`;
export const isRole = (id: string) => id.startsWith(ROLE);
/** Cards that stand for no one yet: placeholders and open roles. */
export const isPlaceholder = (id: string) => isMore(id) || isRole(id);

/** What HR sees coming for someone after the chart's date: the first upcoming change only. */
export interface UpcomingFlag {
  kind: "join" | "leave" | "move";
  date: string;
  /** The manager they join or move to. */
  managerKey: string | null;
}

export interface OrgTree {
  people: Map<string, OrgChartPersonDto>;
  /** People who join later: dashed cards under their manager, outside every count. */
  ghosts: Set<string>;
  flags: Map<string, UpcomingFlag>;
  /** Open roles on the chart, by node id (`role:<id>`). */
  roles: Map<string, OrgChartOpenRoleDto>;
  /** Visible children per person: people, then open roles, the `more:` placeholder last. */
  kids: Map<string, string[]>;
  /** Hidden people counted under a visible person. */
  folds: Map<string, number>;
  roots: string[];
  viewerKey: string | null;
}

const byName = (a: OrgChartPersonDto, b: OrgChartPersonDto) => a.displayName.localeCompare(b.displayName);

const FLAG_KIND = { Join: "join", Leave: "leave", Move: "move" } as const;

/**
 * The reporting tree as of the chart's date. With `upcoming` (HR's changes after that date), joiners whose manager is
 * on the chart come in as ghosts, and the first change coming for each person is flagged.
 */
export function buildTree(chart: OrgChartDto, upcoming: OrgChartChangeDto[] = []): OrgTree {
  const people = new Map(chart.people.map((person) => [person.employeeKey, person]));
  const ghosts = new Set<string>();
  const flags = new Map<string, UpcomingFlag>();
  for (const change of [...upcoming].sort((a, b) => a.date.localeCompare(b.date))) {
    if (flags.has(change.employeeKey)) continue;
    if (change.kind === "Join") {
      if (people.has(change.employeeKey) || !change.person || !change.managerKey || !people.has(change.managerKey)) continue;
      people.set(change.employeeKey, { ...change.person, managerKey: change.managerKey, dottedLineManagerKeys: [] });
      ghosts.add(change.employeeKey);
    } else if (!people.has(change.employeeKey)) continue;
    flags.set(change.employeeKey, { kind: FLAG_KIND[change.kind], date: change.date, managerKey: change.managerKey });
  }
  const kids = new Map<string, string[]>();
  const roots: OrgChartPersonDto[] = [];
  for (const person of [...people.values()].sort(byName)) {
    const manager = person.managerKey && people.has(person.managerKey) ? person.managerKey : null;
    if (!manager) {
      roots.push(person);
      continue;
    }
    kids.set(manager, [...(kids.get(manager) ?? []), person.employeeKey]);
  }
  const roles = new Map<string, OrgChartOpenRoleDto>();
  for (const role of chart.openRoles ?? []) {
    if (!people.has(role.managerKey)) continue;
    roles.set(roleId(role.id), role);
    kids.set(role.managerKey, [...(kids.get(role.managerKey) ?? []), roleId(role.id)]);
  }
  const folds = new Map<string, number>();
  for (const fold of chart.folded) {
    if (!people.has(fold.parentKey)) continue;
    folds.set(fold.parentKey, fold.count);
    kids.set(fold.parentKey, [...(kids.get(fold.parentKey) ?? []), moreId(fold.parentKey)]);
  }
  roots.sort((a, b) => b.totalCount - a.totalCount || byName(a, b));
  return { people, ghosts, flags, roles, kids, folds, roots: roots.map((person) => person.employeeKey), viewerKey: chart.viewerKey };
}

export const isLead = (tree: OrgTree, id: string) => !isPlaceholder(id) && (tree.kids.get(id)?.length ?? 0) > 0;

/** A leader's open roles, in their line. */
export const openRolesOf = (tree: OrgTree, id: string) => (tree.kids.get(id) ?? []).filter(isRole);

export function parentOf(tree: OrgTree, id: string): string | null {
  if (isMore(id)) return id.slice(MORE.length);
  if (isRole(id)) return tree.roles.get(id)?.managerKey ?? null;
  const manager = tree.people.get(id)?.managerKey ?? null;
  return manager && tree.people.has(manager) ? manager : null;
}

/** The managers above someone, top of the company first. */
export function chainOf(tree: OrgTree, id: string): string[] {
  const chain: string[] = [];
  const seen = new Set([id]);
  for (let up = parentOf(tree, id); up && !seen.has(up); up = parentOf(tree, up)) {
    seen.add(up);
    chain.unshift(up);
  }
  return chain;
}

/** The person and everyone up to the top: the line search lights. */
export function litLine(tree: OrgTree, id: string | null): Set<string> {
  if (!id || !tree.people.has(id)) return new Set();
  return new Set([...chainOf(tree, id), id]);
}

export function isInBranchOf(tree: OrgTree, id: string, leader: string): boolean {
  return id === leader || chainOf(tree, id).includes(leader);
}

// ── Lenses ──────────────────────────────────────────────────────────────

export interface LensValue {
  key: string;
  label: string;
  /** A CSS colour when the lens colours cards; null when it only labels them. */
  color: string | null;
}

/** Colour only for five or fewer categories (identity hues); with more, cards carry the label and the legend filters. */
const MAX_HUES = 5;

export interface LensWords {
  leadership: string;
  /** Under a year, 1 to 3 years, 3 to 5 years, 5 years or more. */
  tenure: [string, string, string, string];
  /** 1 to 3 direct reports, 4 to 7, 8 or more. */
  span: [string, string, string];
}

/** An ordered scale: one hue, stronger with each step (the canvas's tenure ramp). */
const ramp = (percent: number) => `color-mix(in oklab, var(--identity-1) ${percent}%, var(--card))`;
const TENURE_STEPS = [30, 55, 80, 100];
const SPAN_STEPS = [40, 70, 100];
const YEAR_MS = 365.25 * 24 * 3600 * 1000;

/** Whole years between two yyyy-mm-dd dates, as a fraction. */
export const yearsBetween = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / YEAR_MS;

/** Ordered lenses list their legend in scale order, categories by name. */
export const isOrderedLens = (lens: LensKey) => lens === "tenure" || lens === "span";

export function createLens(tree: OrgTree, lens: LensKey, words: LensWords, asOf: string): (id: string) => LensValue | null {
  if (lens === "none") return () => null;
  if (lens === "tenure") {
    return (id) => {
      const start = tree.ghosts.has(id) ? null : tree.people.get(id)?.startDate;
      if (!start) return null;
      const years = yearsBetween(start, asOf);
      const step = years < 1 ? 0 : years < 3 ? 1 : years < 5 ? 2 : 3;
      return { key: `t${step}`, label: words.tenure[step], color: ramp(TENURE_STEPS[step]!) };
    };
  }
  if (lens === "span") {
    // Team size is a leader's fact; everyone else stays neutral.
    return (id) => {
      const direct = tree.people.get(id)?.directCount ?? 0;
      if (!direct) return null;
      const step = direct <= 3 ? 0 : direct <= 7 ? 1 : 2;
      return { key: `s${step}`, label: words.span[step], color: ramp(SPAN_STEPS[step]!) };
    };
  }
  if (lens === "location") {
    return (id) => {
      const place = tree.people.get(id)?.workLocation;
      return place ? { key: place, label: place, color: null } : null;
    };
  }
  const divisions = new Map<string, string>();
  for (const person of tree.people.values()) {
    if (person.unit?.divisionId) divisions.set(person.unit.divisionId, person.unit.divisionName ?? "");
  }
  const ordered = [...divisions].sort((a, b) => a[1].localeCompare(b[1]));
  const colored = ordered.length <= MAX_HUES;
  const hue = new Map(ordered.map(([id], index) => [id, `var(--identity-${index + 1})`]));
  return (id) => {
    const person = tree.people.get(id);
    if (!person?.unit) return null;
    const division = person.unit.divisionId;
    if (!division) return { key: "lead", label: words.leadership, color: colored ? "var(--primary)" : null };
    return { key: division, label: divisions.get(division) ?? "", color: colored ? (hue.get(division) ?? null) : null };
  };
}

// ── Layout ──────────────────────────────────────────────────────────────

/** Card and gap sizes from the canvas: lead 248×214 (the top's 292×240), person 252×84, spine gap 52. */
export const G = { LW: 248, LH: 214, RW: 292, RH: 240, PW: 252, PH: 84, SP: 52, RG: 16, VG: 70, HG: 40, TOP: 48, CHAIN: 70 };

export type NodeKind = "lead" | "pc" | "chain" | "more" | "role";
export interface LayoutNode { x: number; y: number; w: number; h: number; kind: NodeKind; top: boolean }
export interface LayoutEdge { from: string; to: string; type: "down" | "fish" | "tree"; sx: number; sy: number; side?: "l" | "r" }
export interface Layout { nodes: Map<string, LayoutNode>; edges: LayoutEdge[]; folded: Set<string>; root: string | null }

export interface LayoutState {
  view: OrgView;
  focus: string | null;
  /** Whole company: teams the viewer folded. */
  folded: Set<string>;
  /** Around someone: sub-teams the viewer opened. */
  unfolded: Set<string>;
}

export function layoutChart(tree: OrgTree, state: LayoutState): Layout {
  const nodes = new Map<string, LayoutNode>();
  const edges: LayoutEdge[] = [];
  const lead = (id: string) => isLead(tree, id);
  const isTop = (id: string) => !isMore(id) && parentOf(tree, id) === null && lead(id);

  let tops: string[] = tree.roots;
  let chain: string[] = [];
  let folded = state.folded;
  if (state.view === "focus" && state.focus && tree.people.has(state.focus)) {
    const focus = state.focus;
    const root = lead(focus) || !parentOf(tree, focus) ? focus : parentOf(tree, focus)!;
    tops = [root];
    chain = chainOf(tree, root);
    folded = new Set((tree.kids.get(root) ?? []).filter((kid) => lead(kid) && !state.unfolded.has(kid)));
  }

  const children = (id: string) => (folded.has(id) ? [] : (tree.kids.get(id) ?? []));
  const dims = (id: string): [number, number] => (isTop(id) ? [G.RW, G.RH] : [G.LW, G.LH]);
  const widths = new Map<string, number>();
  function measure(id: string): number {
    const known = widths.get(id);
    if (known !== undefined) return known;
    if (!lead(id)) return G.PW;
    const all = children(id);
    const ics = all.filter((kid) => !lead(kid));
    const leads = all.filter(lead);
    const spine = !ics.length ? 0 : ics.length === 1 ? G.PW : 2 * G.PW + G.SP;
    const branches = leads.reduce((sum, kid) => sum + measure(kid), 0) + Math.max(0, leads.length - 1) * G.HG;
    const width = Math.max(dims(id)[0], spine, branches);
    widths.set(id, width);
    return width;
  }

  function placeLead(id: string, x: number, y: number) {
    const cx = x + measure(id) / 2;
    const [w, h] = dims(id);
    nodes.set(id, { x: cx - w / 2, y, w, h, kind: "lead", top: isTop(id) });
    const all = children(id);
    const ics = all.filter((kid) => !lead(kid));
    const leads = all.filter(lead);
    const first = y + h + G.TOP;
    let bottom = y + h;
    ics.forEach((kid, i) => {
      const one = ics.length === 1;
      const col = i % 2;
      const px = one ? cx - G.PW / 2 : col === 0 ? cx - G.SP / 2 - G.PW : cx + G.SP / 2;
      const py = first + Math.floor(i / 2) * (G.PH + G.RG);
      nodes.set(kid, { x: px, y: py, w: G.PW, h: G.PH, kind: isMore(kid) ? "more" : isRole(kid) ? "role" : "pc", top: false });
      edges.push(one
        ? { from: id, to: kid, type: "down", sx: cx, sy: y + h }
        : { from: id, to: kid, type: "fish", sx: cx, sy: y + h, side: col === 0 ? "l" : "r" });
      bottom = py + G.PH;
    });
    if (leads.length) {
      const busFrom = bottom;
      const below = bottom + G.VG + 34;
      const total = leads.reduce((sum, kid) => sum + measure(kid), 0) + (leads.length - 1) * G.HG;
      let mx = cx - total / 2;
      for (const kid of leads) {
        placeLead(kid, mx, below);
        edges.push({ from: id, to: kid, type: "tree", sx: cx, sy: busFrom });
        mx += measure(kid) + G.HG;
      }
    }
  }

  const startY = chain.length ? chain.length * G.CHAIN + 60 : 0;
  let x = 0;
  for (const top of tops) {
    if (lead(top)) placeLead(top, x, startY);
    else nodes.set(top, { x, y: startY, w: G.PW, h: G.PH, kind: "pc", top: false });
    x += measure(top) + G.HG * 2;
  }

  const root = tops[0] ?? null;
  const rootNode = root ? nodes.get(root) : undefined;
  if (rootNode) {
    const cx = rootNode.x + rootNode.w / 2;
    chain.forEach((id, i) => {
      nodes.set(id, { x: cx - 150, y: i * G.CHAIN, w: 300, h: 54, kind: "chain", top: false });
      edges.push({ from: id, to: chain[i + 1] ?? root!, type: "down", sx: cx, sy: i * G.CHAIN + 54 });
    });
  }
  return { nodes, edges, folded, root };
}

// ── Geometry ────────────────────────────────────────────────────────────

/** Orthogonal line with soft corners (radius 12). */
export function elbow(x1: number, y1: number, x2: number, y2: number, my: number): string {
  if (Math.abs(x2 - x1) < 1) return `M${x1},${y1}V${y2}`;
  const r = Math.min(12, Math.abs(x2 - x1) / 2, Math.abs(my - y1), Math.abs(y2 - my));
  const dx = Math.sign(x2 - x1);
  return `M${x1},${y1}V${my - r}Q${x1},${my} ${x1 + dx * r},${my}H${x2 - dx * r}Q${x2},${my} ${x2},${my + r}V${y2}`;
}

/** The avatar of a lead card breaks its top edge by 34px; lines end on it. */
const AVATAR_RISE = 34;

export function edgePath(edge: LayoutEdge, to: LayoutNode): string {
  if (edge.type === "fish") {
    const cy = to.y + to.h / 2;
    const ex = edge.side === "l" ? to.x + to.w : to.x;
    const dx = edge.side === "l" ? -1 : 1;
    const r = 12;
    return `M${edge.sx},${edge.sy}V${cy - r}Q${edge.sx},${cy} ${edge.sx + dx * r},${cy}H${ex}`;
  }
  if (edge.type === "down") return `M${edge.sx},${edge.sy}V${to.y - (to.kind === "lead" ? AVATAR_RISE : 0)}`;
  const ty = to.y - AVATAR_RISE;
  return elbow(edge.sx, edge.sy, to.x + to.w / 2, ty, ty - G.VG / 2 - 6);
}

/** A dotted-line manager: a curve from the person's side to the manager's card. */
export function dottedPath(from: LayoutNode, to: LayoutNode): string {
  const right = to.x > from.x;
  const ax = right ? from.x + from.w : from.x;
  const ay = from.y + from.h / 2;
  const bx = right ? to.x : to.x + to.w;
  const by = to.y + 60;
  const k = Math.max(120, Math.abs(bx - ax) / 3);
  return `M${ax},${ay} C${ax + (right ? k : -k)},${ay} ${bx - (right ? k : -k)},${by} ${bx},${by}`;
}

export interface Bounds { x0: number; y0: number; x1: number; y1: number }

export function boundsOf(nodes: Map<string, LayoutNode>, ids?: string[]): Bounds {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [id, n] of nodes) {
    if (ids && !ids.includes(id)) continue;
    x0 = Math.min(x0, n.x);
    y0 = Math.min(y0, n.y - (n.kind === "lead" ? 44 : 0));
    x1 = Math.max(x1, n.x + n.w);
    y1 = Math.max(y1, n.y + n.h + 14);
  }
  return x0 === Infinity ? { x0: 0, y0: 0, x1: 1, y1: 1 } : { x0, y0, x1, y1 };
}

export interface Camera { x: number; y: number; s: number }
export interface Viewport { width: number; height: number; panel: number }

export const MIN_ZOOM = 0.12;
export const MAX_ZOOM = 1.6;

/** Fit everything, centred, never above `maxS`. */
export function fitTo(b: Bounds, v: Viewport, maxS = 1, pad = 36): Camera {
  const width = v.width - v.panel;
  const s = Math.max(MIN_ZOOM, Math.min(maxS, (width - pad * 2) / (b.x1 - b.x0), (v.height - pad * 2) / (b.y1 - b.y0)));
  return { s, x: (width - (b.x1 - b.x0) * s) / 2 - b.x0 * s, y: Math.max(pad, (v.height - (b.y1 - b.y0) * s) / 2) - b.y0 * s };
}

/** Around someone opens at full size, top-aligned: pan down for the rest. */
export function fitTop(b: Bounds, v: Viewport, pad = 40): Camera {
  const width = v.width - v.panel;
  const s = Math.max(MIN_ZOOM, Math.min(1, (width - pad * 2) / (b.x1 - b.x0)));
  const tall = (b.y1 - b.y0) * s > v.height - pad * 2;
  return { s, x: (width - (b.x1 - b.x0) * s) / 2 - b.x0 * s, y: tall ? pad + 10 - b.y0 * s : (v.height - (b.y1 - b.y0) * s) / 2 - b.y0 * s };
}

export function centerOn(n: LayoutNode, v: Viewport, s: number): Camera {
  return { s, x: (v.width - v.panel) / 2 - (n.x + n.w / 2) * s, y: v.height / 2 - (n.y + n.h / 2) * s };
}

/** Same geometry, less detail: names and titles below 52%, tiles in the lens colour below 34%. */
export function zoomTier(s: number): "near" | "mid" | "far" {
  return s < 0.34 ? "far" : s < 0.52 ? "mid" : "near";
}

// ── Search and keyboard ─────────────────────────────────────────────────

export function searchPeople(tree: OrgTree, query: string, limit = 7): OrgChartPersonDto[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return [...tree.people.values()]
    .filter((p) => `${p.displayName} ${p.jobTitle ?? ""} ${p.unit?.name ?? ""}`.toLowerCase().includes(q))
    .sort((a, b) => Number(!a.displayName.toLowerCase().startsWith(q)) - Number(!b.displayName.toLowerCase().startsWith(q)) || byName(a, b))
    .slice(0, limit);
}

/** Arrow keys move between manager (up), reports (down) and peers (left, right). */
export function stepFrom(tree: OrgTree, id: string, key: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight"): string | null {
  if (key === "ArrowUp") return parentOf(tree, id);
  if (key === "ArrowDown") return isRole(id) ? null : (tree.kids.get(id) ?? []).find((kid) => !isMore(kid)) ?? null;
  const parent = parentOf(tree, id);
  const peers = (parent ? (tree.kids.get(parent) ?? []) : tree.roots).filter((kid) => !isMore(kid));
  const at = peers.indexOf(id);
  if (at < 0 || peers.length < 2) return null;
  return peers[(at + (key === "ArrowRight" ? 1 : peers.length - 1)) % peers.length] ?? null;
}

// ── Time (HR) ───────────────────────────────────────────────────────────

const DAY_MS = 24 * 3600 * 1000;
export const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (day: string, days: number) => isoDay(Date.parse(day) + days * DAY_MS);
export const dayIndex = (day: string) => Math.round(Date.parse(day) / DAY_MS);
export const dayAt = (index: number) => isoDay(index * DAY_MS);

/** The time bar's window, as on the canvas: the 1st of the month nine months back to the end of the month two ahead. */
export function timeWindow(today: string): { lo: string; hi: string } {
  const [y, m] = today.split("-").map(Number) as [number, number];
  return {
    lo: isoDay(Date.UTC(y, m - 1 - 9, 1)),
    hi: isoDay(Date.UTC(y, m - 1 + 3, 0)),
  };
}

/** Month ticks every other month inside the window, leaving room around Today. */
export function monthTicks(lo: string, hi: string, today: string): string[] {
  const ticks: string[] = [];
  const [y, m] = lo.split("-").map(Number) as [number, number];
  for (let i = 1; ; i += 2) {
    const tick = isoDay(Date.UTC(y, m - 1 + i, 1));
    if (tick > hi) break;
    if (Math.abs(dayIndex(tick) - dayIndex(today)) > 31) ticks.push(tick);
  }
  return ticks;
}

/** Replay: the company's first day, the 1st of each quarter after it, then today. */
export function replaySteps(first: string, today: string): string[] {
  const [y, m] = first.split("-").map(Number) as [number, number];
  const steps: string[] = [];
  for (let q = Math.floor((m - 1) / 3) * 3; ; q += 3) {
    const step = isoDay(Date.UTC(y, q, 1));
    if (step >= today) break;
    if (step > first) steps.push(step);
  }
  return first < today ? [first, ...steps, today] : [today];
}
