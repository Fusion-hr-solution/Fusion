export type OrganizationRepresentation = "chart" | "outline";

export interface OrganizationUrlState {
  representation: OrganizationRepresentation;
  asOf: string;
  selectedId: string | null;
  search: string;
}

export interface MoveProposal {
  sourceId: string;
  fromParentId: string | null;
  toParentId: string | null;
  effectiveDate: string;
  version: number;
  subordinateCount: number;
  entry: "drag" | "explicit";
  error: string | null;
}

export type UnitFormMode = { kind: "add"; parentId: string | null } | { kind: "edit"; unit: OrganizationUnitStateDto } | null;

export interface OrganizationLocalState {
  collapsed: Set<string>;
  unitForm: UnitFormMode;
  manageTypes: boolean;
  createType: boolean;
  createdTypeId: string | null;
  upcomingOpen: boolean;
  moveProposal: MoveProposal | null;
  inactivateUnit: OrganizationUnitStateDto | null;
  correction: { unit: OrganizationUnitStateDto; date: string } | null;
  cancelChange: OrganizationChangeDto | null;
  inspectorOpen: boolean;
}

export type OrganizationLocalAction =
  | { type: "patch"; value: Partial<OrganizationLocalState> }
  | { type: "toggle-collapse"; id: string }
  | { type: "reveal"; id: string; model: OrganizationHierarchyModel };

export function organizationLocalReducer(state: OrganizationLocalState, action: OrganizationLocalAction): OrganizationLocalState {
  if (action.type === "patch") return { ...state, ...action.value };
  if (action.type === "reveal") return { ...state, collapsed: revealOrganizationUnit(state.collapsed, action.model, action.id) };
  const collapsed = new Set(state.collapsed);
  if (collapsed.has(action.id)) collapsed.delete(action.id); else collapsed.add(action.id);
  return { ...state, collapsed };
}

export function todayCalendarDate(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function readOrganizationUrlState(params: URLSearchParams, today = todayCalendarDate()): OrganizationUrlState {
  return {
    representation: params.get("view") === "outline" ? "outline" : "chart",
    asOf: params.get("asOf") || today,
    selectedId: params.get("unit"),
    search: params.get("q") ?? "",
  };
}

export function writeOrganizationUrlState(state: OrganizationUrlState, today = todayCalendarDate()) {
  const params = new URLSearchParams();
  if (state.representation === "outline") params.set("view", "outline");
  if (state.asOf !== today) params.set("asOf", state.asOf);
  if (state.selectedId) params.set("unit", state.selectedId);
  if (state.search) params.set("q", state.search);
  return params;
}

export function organizationCodeSuggestion(name: string) {
  const words = name.trim().toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  if (words.length === 0) return "";
  if (words.length === 1) return words[0]!.slice(0, 8);
  return words.map((word) => word[0]).join("").slice(0, 8);
}
import type { OrganizationChangeDto, OrganizationUnitStateDto } from "@repo/api";
import { revealOrganizationUnit, type OrganizationHierarchyModel } from "./hierarchy";
