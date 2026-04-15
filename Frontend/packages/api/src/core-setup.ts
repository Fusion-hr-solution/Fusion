export type CoreSetupPhase =
  | "notStarted"
  | "activated"
  | "structurallyGoverned"
  | "structurallyPublished"
  | "operational";

export interface TenantSetupStateDto {
  version: number | null;
  currentPhase: CoreSetupPhase;
  currentStep: number;
  totalSteps: number;
  nextAction: string;
  completedSteps: string[];
  pendingSteps: string[];
  canStartSetup: boolean;
  canResumeSetup: boolean;
  activatedAt: string | null;
  structurallyGovernedAt: string | null;
  structurallyPublishedAt: string | null;
  operationalAt: string | null;
}

export const coreSetupPaths = {
  state: () => "/corehr/setup",
  activate: () => "/corehr/setup/activate",
} as const;
