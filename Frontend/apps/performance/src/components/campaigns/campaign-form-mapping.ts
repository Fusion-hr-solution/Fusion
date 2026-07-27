import { ApiError } from "@repo/api";
import type {
  CampaignStrategicObjectiveDto,
  CreatePerformanceCycleRequest,
  PerformanceCycleDetailDto,
  UpdatePerformanceCycleRequest,
  UpsertCampaignStrategicObjectiveRequest,
} from "@repo/api";

export type DraftForm = {
  name: string;
  purpose: string;
  referenceYear: number;
  planningOpeningDate: string;
  employeeSubmissionDeadline: string;
  managerApprovalDeadline: string;
  expectedPlanningLockDate: string;
};

export type ObjectiveForm = {
  title: string;
  description: string;
  responsibleFunctionLabel: string;
};

export function emptyObjectiveForm(): ObjectiveForm {
  return { title: "", description: "", responsibleFunctionLabel: "" };
}

export function fromCampaign(campaign: PerformanceCycleDetailDto): DraftForm {
  return {
    name: campaign.name,
    purpose: campaign.purpose ?? campaign.description ?? "",
    referenceYear:
      campaign.referenceYear ?? new Date(campaign.periodStart).getUTCFullYear(),
    planningOpeningDate: toDateInput(campaign.planningOpeningDate ?? campaign.periodStart),
    employeeSubmissionDeadline: toDateInput(
      campaign.employeeSubmissionDeadline ?? campaign.objectiveSettingDeadline ?? campaign.periodStart,
    ),
    managerApprovalDeadline: toDateInput(
      campaign.managerApprovalDeadline ?? campaign.objectiveSettingDeadline ?? campaign.periodStart,
    ),
    expectedPlanningLockDate: toDateInput(campaign.expectedPlanningLockDate ?? campaign.periodEnd),
  };
}

export function fromObjective(objective: CampaignStrategicObjectiveDto): ObjectiveForm {
  return {
    title: objective.title,
    description: objective.description ?? "",
    responsibleFunctionLabel: objective.responsibleFunctionLabel ?? "",
  };
}

export function toDraftRequest(
  form: DraftForm,
): CreatePerformanceCycleRequest | UpdatePerformanceCycleRequest {
  return {
    name: form.name.trim(),
    purpose: nullIfBlank(form.purpose),
    referenceYear: form.referenceYear,
    planningOpeningDate: toIsoDate(form.planningOpeningDate),
    employeeSubmissionDeadline: toIsoDate(form.employeeSubmissionDeadline),
    managerApprovalDeadline: toIsoDate(form.managerApprovalDeadline),
    expectedPlanningLockDate: toIsoDate(form.expectedPlanningLockDate),
  };
}

export function toObjectiveRequest(form: ObjectiveForm): UpsertCampaignStrategicObjectiveRequest {
  return {
    title: form.title.trim(),
    description: nullIfBlank(form.description),
    responsibleFunctionLabel: nullIfBlank(form.responsibleFunctionLabel),
  };
}

export function validateDraftForm(form: DraftForm): string[] {
  const errors: string[] = [];
  if (!form.name.trim()) errors.push("Campaign name is required.");
  if (!form.referenceYear) errors.push("Reference year is required.");
  const dates = [
    form.planningOpeningDate,
    form.employeeSubmissionDeadline,
    form.managerApprovalDeadline,
    form.expectedPlanningLockDate,
  ];
  if (dates.some((date) => !date)) errors.push("All planning schedule dates are required.");
  if (dates.every(Boolean)) {
    if (form.employeeSubmissionDeadline < form.planningOpeningDate) errors.push("Employee submission cannot be before planning opening.");
    if (form.managerApprovalDeadline < form.employeeSubmissionDeadline) errors.push("Manager approval cannot be before employee submission.");
    if (form.expectedPlanningLockDate < form.managerApprovalDeadline) errors.push("Planning lock cannot be before manager approval.");
  }
  return errors;
}

export function serializeDraftForm(form: DraftForm): string {
  return JSON.stringify(form);
}

export function errorToMessages(error: Error): string[] {
  if (error instanceof ApiError) {
    if (error.status === 409) return ["This campaign changed. Your edits are still here; review the latest values before saving again."];
    if (error.status === 403) return ["You do not have permission for this campaign action."];
    return error.errors.length > 0 ? error.errors : [error.message];
  }
  if ("status" in error && (error as { status?: number }).status === 409) return ["This campaign changed. Your edits are still here; review the latest values before saving again."];
  if ("status" in error && (error as { status?: number }).status === 403) return ["You do not have permission for this campaign action."];
  return [error.message];
}

export function dayGap(from: string, to: string): number {
  const start = Date.parse(from);
  const end = Date.parse(to);
  return Number.isNaN(start) || Number.isNaN(end) ? 0 : Math.round((end - start) / 86_400_000);
}

export function toDateInput(value: string): string { return value.slice(0, 10); }
export function toIsoDate(value: string): string { return `${value}T00:00:00.000Z`; }
export function nullIfBlank(value: string): string | null { const trimmed = value.trim(); return trimmed ? trimmed : null; }
export function formatDate(value: string): string { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)); }

export function parseWeights(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((item) => `${item}%`);
  } catch { /* Existing configs may use comma-separated values. */ }
  return value.split(",").map((item) => item.trim()).filter(Boolean).map((item) => item.endsWith("%") ? item : `${item}%`);
}

export function parseMeasurementMethods(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
