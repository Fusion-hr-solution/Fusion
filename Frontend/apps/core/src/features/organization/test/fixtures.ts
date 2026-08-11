import type {
  OrganizationChangeDto,
  OrganizationHierarchyDto,
  OrganizationProblem,
  OrganizationReadinessDto,
} from "@repo/api";

const unit = (id: string, name: string, code: string, parentId: string | null, parentName: string | null, typeName = "Division") => ({
  id,
  name,
  code,
  typeId: typeName.toLowerCase(),
  typeName,
  parentId,
  parentName,
  path: parentName ? `${parentName} / ${name}` : name,
  lifecycleState: "Active" as const,
  effectiveFrom: "2026-01-01",
  version: 1,
});

export const asteriaHierarchy: OrganizationHierarchyDto = {
  asOf: "2026-08-09",
  roots: [{
    unit: unit("asteria", "Asteria Group", "AST", null, null, "Organization"),
    children: [
      { unit: unit("consulting", "Consulting", "CON", "asteria", "Asteria Group"), children: [
        { unit: unit("technology", "Technology", "TECH", "consulting", "Consulting"), children: [
          { unit: unit("data-ai", "Data & AI", "DAI", "technology", "Technology", "Team"), children: [] },
        ] },
        { unit: unit("operations-consulting", "Operations", "OPS-C", "consulting", "Consulting", "Team"), children: [] },
      ] },
      { unit: unit("commercial", "Commercial", "COM", "asteria", "Asteria Group"), children: [
        { unit: unit("operations-commercial", "Operations", "OPS-M", "commercial", "Commercial", "Team"), children: [] },
      ] },
    ],
  }],
};

export const noRootReadiness: OrganizationReadinessDto = {
  isReady: false,
  reason: "The organization has not been established.",
  hasPermanentRoot: false,
  permanentRootId: null,
  permanentRootFirstEffectiveDate: null,
  isPermanentRootEffective: false,
};

export const futureRootReadiness: OrganizationReadinessDto = {
  isReady: false,
  reason: "The organization root is scheduled.",
  hasPermanentRoot: true,
  permanentRootId: "asteria",
  permanentRootFirstEffectiveDate: "2026-09-01",
  isPermanentRootEffective: false,
};

export const readyReadiness: OrganizationReadinessDto = {
  isReady: true,
  reason: null,
  hasPermanentRoot: true,
  permanentRootId: "asteria",
  permanentRootFirstEffectiveDate: "2026-01-01",
  isPermanentRootEffective: true,
};

export const rootOnlyHierarchy: OrganizationHierarchyDto = {
  asOf: "2026-08-09",
  roots: [{ unit: unit("asteria", "Asteria Group", "AST", null, null, "Organization"), children: [] }],
};

export function hierarchyAsOf(asOf: string): OrganizationHierarchyDto {
  return { ...asteriaHierarchy, asOf };
}

export function organizationChange(overrides: Partial<OrganizationChangeDto> = {}): OrganizationChangeDto {
  return {
    id: "operation-1",
    orgUnitId: "technology",
    unitName: "Technology",
    unitCode: "TECH",
    effectiveDate: "2026-09-01",
    kind: "Move",
    summary: "Technology moves from Consulting to Commercial.",
    isCancelled: false,
    businessEventKinds: ["Moved"],
    before: {
      name: "Technology",
      type: { id: "division", name: "Division" },
      parent: { id: "consulting", name: "Consulting", code: "CON" },
      lifecycleState: "Active",
    },
    after: {
      name: "Technology",
      type: { id: "division", name: "Division" },
      parent: { id: "commercial", name: "Commercial", code: "COM" },
      lifecycleState: "Active",
    },
    ...overrides,
  };
}

export function organizationProblem(
  kind: OrganizationProblem["kind"],
  message = "The Organization request could not be completed."
): OrganizationProblem {
  return { kind, message, fieldErrors: {}, correlationId: "correlation-1" };
}

export const organizationPermissionFixtures = {
  viewOnly: ["core.organization.view"],
  manage: ["core.organization.manage"],
  denied: [],
  legacyOnly: ["core.orgchart.view", "core.setup.manage"],
} as const;

export function largeOrganizationHierarchy(branches = 20, leaves = 20): OrganizationHierarchyDto {
  return {
    asOf: "2026-08-09",
    roots: [{
      unit: unit("root", "Asteria Group", "AST", null, null, "Organization"),
      children: Array.from({ length: branches }, (_, branch) => ({
        unit: unit(`division-${branch}`, `Division ${branch + 1}`, `D${branch + 1}`, "root", "Asteria Group"),
        children: Array.from({ length: leaves }, (_, leaf) => ({
          unit: unit(`team-${branch}-${leaf}`, `Team ${leaf + 1}`, `T${branch + 1}-${leaf + 1}`, `division-${branch}`, `Division ${branch + 1}`, "Team"),
          children: [],
        })),
      })),
    }],
  };
}
