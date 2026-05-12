import type { EmployeeHierarchyStatus } from "./employee-roster.types";

export function getHierarchyIssueMeta(status: EmployeeHierarchyStatus): {
  label: string;
  variant: "destructive";
} | null {
  switch (status) {
    case "ManagerInactive":
      return { label: "Needs reassignment", variant: "destructive" };
    case "ManagerMissing":
      return { label: "Needs attention", variant: "destructive" };
    default:
      return null;
  }
}