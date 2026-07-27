import { ApiError } from "@repo/api";
import type { EmployeeObjectiveDto } from "@repo/api";
import { measurementMethodLabel } from "@/lib/labels";
import { myObjectiveTerms } from "./my-objectives-terms";

export type ReadinessCheck = { label: string; done: boolean };
export function objectiveComplete(objective: EmployeeObjectiveDto): boolean {
  if (!objective.title || !objective.alignmentTargetId || !objective.weight || !objective.deadline || !objective.measurementMethod) return false;
  if (objective.measurementMethod === "Quantitative") return !!objective.measurementIndicator && !!objective.targetValue;
  if (objective.measurementMethod === "Qualitative") return !!objective.successCriteria;
  return false;
}
export function readinessChecks(objectives: EmployeeObjectiveDto[], totalWeight: number, maxObjectiveCount: number): ReadinessCheck[] {
  return [
    { label: "Add at least one objective", done: objectives.length > 0 },
    { label: `Keep to ${maxObjectiveCount} objectives`, done: objectives.length <= maxObjectiveCount },
    { label: "Balance weights to 100%", done: totalWeight === 100 },
    { label: "Fill in every objective's missing details", done: objectives.length > 0 && objectives.every(objectiveComplete) },
  ];
}
export function objectiveMissingFields(objective: EmployeeObjectiveDto): string[] {
  const missing: string[] = [];
  if (!objective.title) missing.push("objective");
  if (!objective.alignmentTargetId) missing.push("supporting goal");
  if (!objective.weight) missing.push("weight");
  if (!objective.deadline) missing.push("target date");
  if (!objective.measurementMethod) { missing.push("measurement"); return missing; }
  if (objective.measurementMethod === "Quantitative") { if (!objective.measurementIndicator) missing.push("indicator"); if (!objective.targetValue) missing.push("target"); }
  if (objective.measurementMethod === "Qualitative" && !objective.successCriteria) missing.push("success criteria");
  return missing;
}
export function describeMeasurement(objective: EmployeeObjectiveDto): string {
  if (!objective.measurementMethod) return "No measurement yet";
  if (objective.measurementMethod === "Quantitative") {
    const target = [objective.targetValue, objective.targetUnit].filter(Boolean).join(" ");
    if (objective.measurementIndicator && target) return `${objective.measurementIndicator}: ${target}`;
    if (objective.measurementIndicator) return objective.measurementIndicator;
  }
  return objective.measurementMethod === "Qualitative" ? objective.successCriteria || measurementMethodLabel(objective.measurementMethod) : measurementMethodLabel(objective.measurementMethod);
}
export function errorMessages(error: Error): string[] {
  if (error instanceof ApiError) {
    if (error.status === 409 || error.status === 412 || error.status === 428) return [myObjectiveTerms.conflict];
    if (error.status === 403) return [error.message || "You do not have permission for this action."];
    return error.errors.length > 0 ? error.errors : [error.message];
  }
  return [error.message];
}
