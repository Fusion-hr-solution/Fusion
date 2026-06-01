import type { EmployeeHierarchyStatus } from "./employee-roster.types";

export function getHierarchyIssueMeta(status: EmployeeHierarchyStatus): {
  label: string;
  variant: "destructive";
} | null {
  switch (status) {
    case "ManagerInactive":
      return { label: "Manager inactive", variant: "destructive" };
    case "ManagerMissing":
      return { label: "Manager missing", variant: "destructive" };
    default:
      return null;
  }
}