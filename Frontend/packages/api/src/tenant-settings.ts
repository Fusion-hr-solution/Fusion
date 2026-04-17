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

export interface TenantSettingsDto {
  version: number | null;
  draftStructureSchema: DraftStructureSchemaDto;
  orgUnitTypes: string[];
  employeeFieldConfig: Record<string, FieldConfigDto>;
  branding: BrandingSettingsDto;
}

export interface UpdateTenantSettingsRequest {
  orgUnitTypes?: string[] | null;
  draftStructureSchema?: DraftStructureSchemaDto | null;
  employeeFieldConfig?: Record<string, FieldConfigInputDto> | null;
  branding?: BrandingSettingsInputDto | null;
}

export const tenantSettingsPaths = {
  current: () => "/corehr/settings",
} as const;