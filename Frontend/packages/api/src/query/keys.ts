export interface EmployeeListParams {
  status?: string;
  managerId?: string;
  orgUnitId?: string;
}

export const queryKeys = {
  orgUnits: {
    all: () => ["corehr", "org-units"] as const,
    list: () => [...queryKeys.orgUnits.all(), "list"] as const,
    detail: (id: string) => [...queryKeys.orgUnits.all(), "detail", id] as const,
    tree: () => [...queryKeys.orgUnits.all(), "tree"] as const,
  },
  employees: {
    all: () => ["corehr", "employees"] as const,
    list: (params?: EmployeeListParams) =>
      [...queryKeys.employees.all(), "list", params ?? {}] as const,
    detail: (id: string) =>
      [...queryKeys.employees.all(), "detail", id] as const,
  },
  setup: {
    state: () => ["corehr", "setup"] as const,
  },
  tenantSettings: {
    current: () => ["corehr", "settings"] as const,
  },
} as const;
