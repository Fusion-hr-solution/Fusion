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

export interface TenantSettingsDto {
  version: number | null;
  draftStructureSchema: DraftStructureSchemaDto;
  orgUnitTypes: string[];
  employeeFieldConfig: Record<string, FieldConfigDto>;
  branding: BrandingSettingsDto;
  selfService: SelfServiceSettingsDto;
}

export interface UpdateTenantSettingsRequest {
  orgUnitTypes?: string[] | null;
  draftStructureSchema?: DraftStructureSchemaDto | null;
  employeeFieldConfig?: Record<string, FieldConfigInputDto> | null;
  branding?: BrandingSettingsInputDto | null;
  selfService?: SelfServiceSettingsInputDto | null;
}

export const tenantSettingsPaths = {
  current: () => "/corehr/settings",
} as const;

export const tenantSettingsQueryKeys = {
  all: () => ["tenantSettings"] as const,
  current: () => [...tenantSettingsQueryKeys.all(), "current"] as const,
} as const;
