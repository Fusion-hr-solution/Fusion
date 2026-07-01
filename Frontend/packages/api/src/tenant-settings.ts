import type { DraftStructureSchemaDto } from "./draft-structure";

export interface FieldConfigDto {
  visible: boolean;
  required: boolean;
  visibleToEmployee: boolean;
  visibleToManager: boolean;
}

export interface BrandingSettingsDto {
  logoUrl: string | null;
  primaryColor: string | null;
}

export interface SelfServiceSettingsDto {
  canEditPreferredName: boolean;
  canEditPhone: boolean;
}

export interface ProvisioningSettingsDto {
  defaultAccessProfileId: string | null;
  inviteExpiryDays: number;
  resendCooldownHours: number;
  pendingInviteBehavior: "RefreshExisting" | "KeepExisting" | string;
}

export interface FieldConfigInputDto {
  visible?: boolean | null;
  required?: boolean | null;
  visibleToEmployee?: boolean | null;
  visibleToManager?: boolean | null;
}

export interface BrandingSettingsInputDto {
  logoUrl?: string | null;
  primaryColor?: string | null;
}

export interface SelfServiceSettingsInputDto {
  canEditPreferredName?: boolean | null;
  canEditPhone?: boolean | null;
}

export interface ProvisioningSettingsInputDto {
  defaultAccessProfileId?: string | null;
  inviteExpiryDays?: number | null;
  resendCooldownHours?: number | null;
  pendingInviteBehavior?: "RefreshExisting" | "KeepExisting" | string | null;
}

export interface TenantSettingsDto {
  version: number | null;
  draftStructureSchema: DraftStructureSchemaDto;
  orgUnitTypes: string[];
  employeeFieldConfig: Record<string, FieldConfigDto>;
  branding: BrandingSettingsDto;
  selfService: SelfServiceSettingsDto;
  provisioning: ProvisioningSettingsDto;
}

export interface UpdateTenantSettingsRequest {
  orgUnitTypes?: string[] | null;
  draftStructureSchema?: DraftStructureSchemaDto | null;
  employeeFieldConfig?: Record<string, FieldConfigInputDto> | null;
  branding?: BrandingSettingsInputDto | null;
  selfService?: SelfServiceSettingsInputDto | null;
  provisioning?: ProvisioningSettingsInputDto | null;
}

export type SettingsSectionGroupDto = "foundation" | "module" | string;
export type SettingsSectionStatusDto = "ready" | "attention" | "disabled" | string;

export interface SettingsSectionDto {
  id: string;
  moduleId: string;
  group: SettingsSectionGroupDto;
  label: string;
  description: string;
  enabled: boolean;
  status: SettingsSectionStatusDto;
  statusLabel: string;
  owner: string;
  auditNamespace: string;
  order: number;
  canView: boolean;
  canManage: boolean;
  requiredViewCapabilities: string[];
  requiredManageCapabilities: string[];
}

export interface SettingsHealthItemDto {
  sectionId: string;
  severity: "ready" | "attention" | "blocked" | string;
  label: string;
  detail: string;
}

export interface SettingsAuditEventDto {
  id: string;
  occurredAt: string;
  actorName: string | null;
  actorRole: string | null;
  sectionId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  summary: string;
  beforeJson: string | null;
  afterJson: string | null;
  correlationId: string | null;
}

export interface SettingsOverviewDto {
  sections: SettingsSectionDto[];
  health: SettingsHealthItemDto[];
  recentSensitiveChanges: SettingsAuditEventDto[];
}

export interface OrganizationSettingsDto {
  version: number | null;
  displayName: string;
  locale: string;
  timeZone: string;
  branding: BrandingSettingsDto;
  usesDefaultBranding: boolean;
}

export interface PeopleDataSettingsDto {
  version: number | null;
  employeeFieldConfig: Record<string, FieldConfigDto>;
  selfService: SelfServiceSettingsDto;
  downstreamConsumers: string[];
}

export interface StructureSettingsDto {
  version: number | null;
  draftStructureSchema: DraftStructureSchemaDto;
  draftStatus: string;
  operationalHandoff: string;
}

export interface ProvisioningSettingsResponseDto {
  version: number | null;
  provisioning: ProvisioningSettingsDto;
  downstreamConsumers: string[];
}

export const tenantSettingsPaths = {
  current: () => "/corehr/settings",
  sections: () => "/corehr/settings/sections",
  overview: () => "/corehr/settings/overview",
  organization: () => "/corehr/settings/organization",
  peopleData: () => "/corehr/settings/people-data",
  structure: () => "/corehr/settings/structure",
  provisioning: () => "/corehr/settings/provisioning",
  audit: () => "/corehr/settings/governance/audit",
} as const;

export const tenantSettingsQueryKeys = {
  all: () => ["tenantSettings"] as const,
  current: () => [...tenantSettingsQueryKeys.all(), "current"] as const,
  sections: () => [...tenantSettingsQueryKeys.all(), "sections"] as const,
  overview: () => [...tenantSettingsQueryKeys.all(), "overview"] as const,
  organization: () => [...tenantSettingsQueryKeys.all(), "organization"] as const,
  peopleData: () => [...tenantSettingsQueryKeys.all(), "people-data"] as const,
  structure: () => [...tenantSettingsQueryKeys.all(), "structure"] as const,
  provisioning: () => [...tenantSettingsQueryKeys.all(), "provisioning"] as const,
  audit: () => [...tenantSettingsQueryKeys.all(), "audit"] as const,
} as const;
