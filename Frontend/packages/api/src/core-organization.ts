export type OrganizationLifecycleState = "Active" | "Inactive" | number;
export type OrganizationChangeKind = "Create" | "Change" | "Move" | "Inactivate" | "Correction" | "CodeCorrection" | number;

export interface OrganizationUnitStateDto {
  id: string;
  code: string;
  name: string;
  typeId: string;
  typeName: string;
  parentId: string | null;
  parentName: string | null;
  path: string;
  lifecycleState: OrganizationLifecycleState;
  effectiveFrom: string;
  version: number;
}

export interface OrganizationHierarchyNodeDto {
  unit: OrganizationUnitStateDto;
  children: OrganizationHierarchyNodeDto[];
}

export interface OrganizationHierarchyDto {
  asOf: string;
  roots: OrganizationHierarchyNodeDto[];
}

export interface OrganizationChangeDto {
  id: string;
  orgUnitId: string;
  unitName: string;
  unitCode: string;
  effectiveDate: string;
  kind: OrganizationChangeKind;
  summary: string | null;
  isCancelled: boolean;
}

export interface OrganizationReadinessDto {
  isReady: boolean;
  reason: string | null;
}

export interface OrganizationalUnitTypeDto {
  id: string;
  displayName: string;
  isBuiltIn: boolean;
}

export const coreOrganizationPaths = {
  hierarchy: () => "/corehr/organization/hierarchy",
  unit: (id: string) => `/corehr/organization/units/${id}`,
  search: () => "/corehr/organization/search",
  history: (id: string) => `/corehr/organization/units/${id}/history`,
  upcomingChanges: () => "/corehr/organization/changes/upcoming",
  readiness: () => "/corehr/organization/readiness",
  types: () => "/corehr/organization/types",
  root: () => "/corehr/organization/root",
  units: () => "/corehr/organization/units",
  change: (id: string) => `/corehr/organization/units/${id}/change`,
  move: (id: string) => `/corehr/organization/units/${id}/move`,
  inactivate: (id: string) => `/corehr/organization/units/${id}/inactivate`,
  correct: (id: string) => `/corehr/organization/units/${id}/correct`,
  correctCode: (id: string) => `/corehr/organization/units/${id}/correct-code`,
  cancelChange: (id: string) => `/corehr/organization/changes/${id}/cancel`,
  type: (id: string) => `/corehr/organization/types/${id}`,
} as const;

export const coreOrganizationQueryKeys = {
  all: () => ["coreOrganization"] as const,
  hierarchy: (asOf: string) => [...coreOrganizationQueryKeys.all(), "hierarchy", asOf] as const,
  unit: (id: string, asOf: string) => [...coreOrganizationQueryKeys.all(), "unit", id, asOf] as const,
  history: (id: string) => [...coreOrganizationQueryKeys.all(), "history", id] as const,
  upcomingChanges: () => [...coreOrganizationQueryKeys.all(), "upcomingChanges"] as const,
  readiness: () => [...coreOrganizationQueryKeys.all(), "readiness"] as const,
  types: () => [...coreOrganizationQueryKeys.all(), "types"] as const,
} as const;
