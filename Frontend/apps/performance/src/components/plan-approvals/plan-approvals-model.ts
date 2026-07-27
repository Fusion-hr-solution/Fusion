import { ApiError } from "@repo/api";
import type { EmployeeObjectiveDto, PlanApprovalReviewDto } from "@repo/api";
import { measurementMethodLabel } from "@/lib/labels";

export function latestChangeRequest(plan: PlanApprovalReviewDto) { return [...plan.reviewHistory].filter((event) => event.type === "ChangesRequested").sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())[0] ?? null; }
export function referencedObjectives(plan: PlanApprovalReviewDto, ids: string[]) { if (ids.length === 0) return []; const referenced = new Set(ids); return plan.objectives.filter((objective) => referenced.has(objective.id)); }
export function samePerson(left: string | null | undefined, right: string | null | undefined) { return Boolean(left && right && left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase()); }
export function describeMeasurement(objective: EmployeeObjectiveDto): string { if (!objective.measurementMethod) return "Not set"; if (objective.measurementMethod === "Quantitative") { const target = [objective.targetValue, objective.targetUnit].filter(Boolean).join(" "); if (objective.measurementIndicator && target) return `${objective.measurementIndicator}: ${target}`; return objective.measurementIndicator ?? measurementMethodLabel(objective.measurementMethod); } return objective.successCriteria ?? measurementMethodLabel(objective.measurementMethod); }
export function reviewEventLabel(type: string): string { if (type === "ChangesRequested") return "Changes requested"; if (type === "Resubmitted") return "Resubmitted"; if (type === "Approved") return "Approved"; return "Submitted"; }
export function errorMessage(error: Error): string { if (error instanceof ApiError) { if (error.status === 409 || error.status === 412 || error.status === 428) return "This plan changed. Review the latest version and try again."; return error.errors[0] ?? error.message; } return error.message; }
