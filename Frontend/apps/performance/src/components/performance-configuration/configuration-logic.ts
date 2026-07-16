// Shared logic for the two performance configuration surfaces (platform + tenant).
// The message strings below are the single source of truth for client-side validation
// and are kept identical to the backend PerformanceConfigurationValidator so a rule
// reads the same whether it is caught locally (instant, for Apply gating) or returned
// by the server. Do not reword one side without the other.

export const PROFESSIONAL_WEIGHT_MENU = [5, 10, 15, 20, 25, 30, 40, 50];
export const MAX_WEIGHT_CHOICES = 10;

export const CONFIG_VALIDATION_MESSAGES = {
  platform: {
    supportedWeightsRequired: "At least one supported weight is required.",
    supportedWeightsIncrement: "Supported objective weights must use 5% increments.",
    supportedWeightsMax: "Supported objective weights must use no more than 10 choices.",
    measurementAvailable: "At least one measurement method must be available.",
    startingCountWithinLimit: "Starting maximum objective count must be within the platform limit.",
    startingWeightsRequired: "Starting allowed weights are required.",
    startingWeightsMax: "Starting allowed weights must use no more than 10 choices.",
    startingWeightsFromSupported: "Starting allowed weights must come from the platform-supported weights.",
    startingMeasurementEnabled: "At least one starting measurement method must be enabled.",
    startingWeightsReachOneHundred:
      "Starting allowed weights must be able to produce a 100% plan within the starting maximum objective count.",
  },
  tenant: {
    countWithinLimit: "Tenant maximum objective count must stay within the platform maximum objective count.",
    atLeastOneWeight: "At least one allowed weight is required.",
    weightsIncrement: "Allowed weights must use 5% increments.",
    weightsMax: "Allowed weights must use no more than 10 choices.",
    measurementEnabled: "At least one measurement method must be enabled.",
    weightsReachOneHundred:
      "Allowed weights must be able to produce a 100% plan within the maximum objective count.",
  },
} as const;

export interface PlatformConfigurationForm {
  maxObjectiveCountLimit: number;
  supportedWeights: number[];
  quantitativeAvailable: boolean;
  qualitativeAvailable: boolean;
  startingMaxObjectiveCount: number;
  startingWeights: number[];
  startingQuantitativeEnabled: boolean;
  startingQualitativeEnabled: boolean;
}

export interface ObjectivePlanningForm {
  maxObjectiveCount: number;
  allowedWeights: number[];
  quantitativeEnabled: boolean;
  qualitativeEnabled: boolean;
}

export function parseWeights(value: string): number[] {
  return value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((weight) => Number.isInteger(weight) && weight > 0)
    .sort((a, b) => a - b);
}

export function serializeWeights(weights: number[]): string {
  return [...weights].sort((a, b) => a - b).join(",");
}

export function mergeWeightChoices(...menus: number[][]): number[] {
  return Array.from(new Set(menus.flat())).sort((a, b) => a - b);
}

// Can the menu produce a plan that sums to exactly 100% using at most maxCount objectives?
// A weight value may be reused across objectives. Mirrors the backend reachability check.
export function canTotalOneHundred(weights: number[], maxCount: number): boolean {
  let possible = new Set([0]);
  for (let count = 0; count < maxCount; count += 1) {
    const next = new Set(possible);
    for (const total of possible) {
      for (const weight of weights) {
        const candidate = total + weight;
        if (candidate === 100) {
          return true;
        }
        if (candidate < 100) {
          next.add(candidate);
        }
      }
    }
    possible = next;
  }
  return possible.has(100);
}

export function validatePlatformForm(form: PlatformConfigurationForm): string[] {
  const m = CONFIG_VALIDATION_MESSAGES.platform;
  const errors: string[] = [];
  if (form.supportedWeights.length === 0) errors.push(m.supportedWeightsRequired);
  if (form.supportedWeights.some((weight) => weight % 5 !== 0)) errors.push(m.supportedWeightsIncrement);
  if (form.supportedWeights.length > MAX_WEIGHT_CHOICES) errors.push(m.supportedWeightsMax);
  if (!form.quantitativeAvailable && !form.qualitativeAvailable) errors.push(m.measurementAvailable);
  if (form.startingMaxObjectiveCount > form.maxObjectiveCountLimit) errors.push(m.startingCountWithinLimit);
  if (form.startingWeights.length === 0) errors.push(m.startingWeightsRequired);
  if (form.startingWeights.length > MAX_WEIGHT_CHOICES) errors.push(m.startingWeightsMax);
  if (form.startingWeights.some((weight) => !form.supportedWeights.includes(weight)))
    errors.push(m.startingWeightsFromSupported);
  if (!form.startingQuantitativeEnabled && !form.startingQualitativeEnabled)
    errors.push(m.startingMeasurementEnabled);
  if (form.startingWeights.length > 0 && !canTotalOneHundred(form.startingWeights, form.startingMaxObjectiveCount))
    errors.push(m.startingWeightsReachOneHundred);
  return errors;
}

export function validatePlanningForm(form: ObjectivePlanningForm, maxObjectiveCountLimit: number): string[] {
  const m = CONFIG_VALIDATION_MESSAGES.tenant;
  const errors: string[] = [];
  if (form.maxObjectiveCount > maxObjectiveCountLimit) errors.push(m.countWithinLimit);
  if (form.allowedWeights.length === 0) errors.push(m.atLeastOneWeight);
  if (form.allowedWeights.some((weight) => weight % 5 !== 0)) errors.push(m.weightsIncrement);
  if (form.allowedWeights.length > MAX_WEIGHT_CHOICES) errors.push(m.weightsMax);
  if (!form.quantitativeEnabled && !form.qualitativeEnabled) errors.push(m.measurementEnabled);
  if (form.allowedWeights.length > 0 && !canTotalOneHundred(form.allowedWeights, form.maxObjectiveCount))
    errors.push(m.weightsReachOneHundred);
  return errors;
}
