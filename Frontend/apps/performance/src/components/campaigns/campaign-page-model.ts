import type { PerformanceCycleDetailDto } from "@repo/api";
import { campaignScheduleSteps } from "./campaign-terminology";
import type { RunwayStepKey } from "./campaign-setup-stepper";
import type { DraftForm } from "./campaign-form-mapping";

export type ScheduleKey =
  | "planningOpeningDate"
  | "employeeSubmissionDeadline"
  | "managerApprovalDeadline"
  | "expectedPlanningLockDate";

export const SCHEDULE_STEP_ORDER = [
  "planningOpeningDate",
  "employeeSubmissionDeadline",
  "managerApprovalDeadline",
  "expectedPlanningLockDate",
] as const satisfies readonly ScheduleKey[];

export const SCHEDULE_STEPS: {
  key: ScheduleKey;
  label: string;
  caption: string;
  short: string;
}[] = SCHEDULE_STEP_ORDER.map((key) => ({ key, ...campaignScheduleSteps[key] }));

export const yearOptions = Array.from(
  { length: 5 },
  (_, index) => new Date().getFullYear() - 1 + index
);

export const STEP_ORDER = [
  "campaign",
  "timeline",
  "strategy",
  "population",
  "launch",
] as const satisfies readonly RunwayStepKey[];

export type StepState = {
  campaign: boolean;
  timeline: boolean;
  timelineError: boolean;
  strategy: boolean;
  population: boolean;
};

export function getStepState(form: DraftForm, campaign: PerformanceCycleDetailDto): StepState {
  const scheduleDates = SCHEDULE_STEPS.map((step) => form[step.key]);
  const scheduleComplete = scheduleDates.every(Boolean);
  const scheduleOrdered = scheduleComplete && scheduleDates.every(
    (value, index) => index === 0 || (scheduleDates[index - 1] ?? "") <= value
  );
  const timelineError = scheduleDates.some(
    (value, index) => index > 0 && !!value && value < (scheduleDates[index - 1] ?? "")
  );
  const activeObjectiveCount = campaign.strategicObjectives.filter((objective) => objective.isActive).length;
  const hasPopulationScope = campaign.populationRules.some(
    (rule) => rule.ruleType === "OrgUnit" || rule.ruleType === "IncludeEmployee"
  );
  return {
    campaign: !!form.name.trim() && !!form.referenceYear,
    timeline: scheduleComplete && scheduleOrdered,
    timelineError,
    strategy: activeObjectiveCount > 0,
    population: hasPopulationScope,
  };
}

export function firstOpenStep(form: DraftForm, campaign: PerformanceCycleDetailDto): RunwayStepKey {
  const state = getStepState(form, campaign);
  if (!state.campaign) return "campaign";
  if (!state.timeline) return "timeline";
  if (!state.strategy) return "strategy";
  if (!state.population) return "population";
  return "launch";
}
