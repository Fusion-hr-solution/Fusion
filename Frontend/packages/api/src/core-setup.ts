export type CoreSetupPhase =
  | "notStarted"
  | "activated"
  | "structurallyGoverned"
  | "structurallyPublished"
  | "operational";

export type TenantSetupActivityType =
  | "approved"
  | "reopened"
  | "published"
  | "completed";

export type DraftSetupIssueSeverity = "error" | "warning";

export type DraftSetupIssueCategory =
  | "structure"
  | "hierarchy"
  | "unitTypes"
  | "requiredDetails";

export interface TenantSetupActivityDto {
  id: string;
  activityType: TenantSetupActivityType;
  occurredAt: string;
  actorUserId: string;
  actorFullName: string;
  actorRole: string;
  isPlatformAssisted: boolean;
}

export interface DraftSetupIssueDto {
  severity: DraftSetupIssueSeverity;
  category: DraftSetupIssueCategory;
  code: string;
  message: string;
  unitId: string | null;
  field: string | null;
}

export interface DraftSetupReadinessDto {
  isReadyForApproval: boolean;
  totalUnitCount: number;
  rootUnitCount: number;
  blockingIssueCount: number;
  warningCount: number;
  blockingIssues: DraftSetupIssueDto[];
  warnings: DraftSetupIssueDto[];
}

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
  approvedAt: string | null;
  approvedByUserId: string | null;
  approvedByFullName: string | null;
  approvedByRole: string | null;
  isApprovedInPlatformAssistMode: boolean;
  structurallyPublishedAt: string | null;
  operationalAt: string | null;
  recentActivities: TenantSetupActivityDto[];
}

export const coreSetupPaths = {
  state: () => "/corehr/setup",
  activate: () => "/corehr/setup/activate",
  readiness: () => "/corehr/setup/readiness",
  approve: () => "/corehr/setup/approve",
  reopen: () => "/corehr/setup/reopen",
  publish: () => "/corehr/setup/publish",
  complete: () => "/corehr/setup/complete",
} as const;

export const coreSetupQueryKeys = {
  all: () => ["coreSetup"] as const,
  state: () => [...coreSetupQueryKeys.all(), "state"] as const,
  readiness: () => [...coreSetupQueryKeys.all(), "readiness"] as const,
} as const;
