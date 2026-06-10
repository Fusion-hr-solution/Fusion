"use client";

import { useMemo } from "react";
import type { FieldConfigDto, TenantSettingsDto } from "@repo/api";
import { useTenantSettings } from "@/features/settings/api/use-tenant-settings";

export type EmployeeFieldKey =
  | "firstName"
  | "lastName"
  | "email"
  | "hireDate"
  | "phone"
  | "jobTitle"
  | "workLocation"
  | "employmentType";

export type EmployeeFieldAudience = "hrAdmin" | "manager" | "employee";

export interface EmployeeFieldDefinition {
  key: EmployeeFieldKey;
  label: string;
  surface: "active" | "prepared";
  defaultConfig: FieldConfigDto;
  locked: boolean;
  requiredLocked?: boolean;
}

export type EmployeeFieldConfigMap = Record<EmployeeFieldKey, FieldConfigDto>;

export interface EmployeeFieldPolicy extends FieldConfigDto {
  locked: boolean;
  requiredLocked: boolean;
  surface: "active" | "prepared";
}

export interface EmployeeFieldPolicyState {
  fields: Record<EmployeeFieldKey, EmployeeFieldPolicy>;
  showHireDate: boolean;
  showJobTitle: boolean;
  showPhone: boolean;
  showWorkLocation: boolean;
  showEmploymentType: boolean;
  requireHireDate: boolean;
  requireJobTitle: boolean;
  requirePhone: boolean;
  requireWorkLocation: boolean;
  requireEmploymentType: boolean;
}

export interface EmployeeFieldVisibility {
  showHireDate: boolean;
  showJobTitle: boolean;
  showPhone: boolean;
  showWorkLocation: boolean;
  showEmploymentType: boolean;
}

export const EMPLOYEE_FIELD_DEFINITIONS: readonly EmployeeFieldDefinition[] = [
  {
    key: "firstName",
    label: "First name",
    surface: "active",
    defaultConfig: {
      visible: true,
      required: true,
      visibleToEmployee: true,
      visibleToManager: true,
    },
    locked: true,
    requiredLocked: true,
  },
  {
    key: "lastName",
    label: "Last name",
    surface: "active",
    defaultConfig: {
      visible: true,
      required: true,
      visibleToEmployee: true,
      visibleToManager: true,
    },
    locked: true,
    requiredLocked: true,
  },
  {
    key: "email",
    label: "Work email",
    surface: "active",
    defaultConfig: {
      visible: true,
      required: true,
      visibleToEmployee: true,
      visibleToManager: true,
    },
    locked: true,
    requiredLocked: true,
  },
  {
    key: "hireDate",
    label: "Hire date",
    surface: "active",
    defaultConfig: {
      visible: true,
      required: true,
      visibleToEmployee: true,
      visibleToManager: true,
    },
    locked: false,
    requiredLocked: true,
  },
  {
    key: "phone",
    label: "Phone",
    surface: "active",
    defaultConfig: {
      visible: true,
      required: false,
      visibleToEmployee: true,
      visibleToManager: true,
    },
    locked: false,
  },
  {
    key: "workLocation",
    label: "Work location",
    surface: "active",
    defaultConfig: {
      visible: true,
      required: false,
      visibleToEmployee: true,
      visibleToManager: true,
    },
    locked: false,
  },
  {
    key: "employmentType",
    label: "Employment type",
    surface: "active",
    defaultConfig: {
      visible: true,
      required: false,
      visibleToEmployee: true,
      visibleToManager: true,
    },
    locked: false,
  },
  {
    key: "jobTitle",
    label: "Job title",
    surface: "active",
    defaultConfig: {
      visible: true,
      required: false,
      visibleToEmployee: true,
      visibleToManager: true,
    },
    locked: false,
  },
] as const;

export const ACTIVE_EMPLOYEE_FIELD_DEFINITIONS =
  EMPLOYEE_FIELD_DEFINITIONS.filter((field) => field.surface === "active");

export const PREPARED_EMPLOYEE_FIELD_DEFINITIONS =
  EMPLOYEE_FIELD_DEFINITIONS.filter((field) => field.surface === "prepared");

export function buildEmployeeFieldConfigDraft(
  settings?: TenantSettingsDto | null
): EmployeeFieldConfigMap {
  return EMPLOYEE_FIELD_DEFINITIONS.reduce((config, field) => {
    const nextConfig =
      settings?.employeeFieldConfig[field.key] ?? field.defaultConfig;
    const required = field.requiredLocked === true ? true : nextConfig.required;

    config[field.key] = {
      ...nextConfig,
      visible: field.locked || required ? true : nextConfig.visible,
      required,
      visibleToEmployee: nextConfig.visibleToEmployee,
      visibleToManager: nextConfig.visibleToManager,
    };

    return config;
  }, {} as EmployeeFieldConfigMap);
}

export function buildEmployeeFieldConfigInput(config: EmployeeFieldConfigMap) {
  return Object.fromEntries(
    EMPLOYEE_FIELD_DEFINITIONS.map((field) => {
      const required =
        field.requiredLocked === true ? true : config[field.key].required;

      return [
        field.key,
        {
          visible: field.locked || required ? true : config[field.key].visible,
          required,
          visibleToEmployee: config[field.key].visibleToEmployee,
          visibleToManager: config[field.key].visibleToManager,
        },
      ];
    })
  );
}

export function getEmployeeFieldPolicy(
  settings?: TenantSettingsDto | null,
  audience: EmployeeFieldAudience = "hrAdmin"
): EmployeeFieldPolicyState {
  const config = buildEmployeeFieldConfigDraft(settings);

  const fields = EMPLOYEE_FIELD_DEFINITIONS.reduce(
    (map, field) => {
      map[field.key] = {
        ...config[field.key],
        visible:
          audience === "employee"
            ? config[field.key].visible && config[field.key].visibleToEmployee
            : audience === "manager"
              ? config[field.key].visible && config[field.key].visibleToManager
              : config[field.key].visible,
        locked: field.locked,
        requiredLocked: field.requiredLocked === true,
        surface: field.surface,
      };

      return map;
    },
    {} as Record<EmployeeFieldKey, EmployeeFieldPolicy>
  );

  return {
    fields,
    showHireDate: fields.hireDate.visible,
    showJobTitle: fields.jobTitle.visible,
    showPhone: fields.phone.visible,
    showWorkLocation: fields.workLocation.visible,
    showEmploymentType: fields.employmentType.visible,
    requireHireDate: fields.hireDate.required,
    requireJobTitle: fields.jobTitle.required,
    requirePhone: fields.phone.required,
    requireWorkLocation: fields.workLocation.required,
    requireEmploymentType: fields.employmentType.required,
  };
}

export function getEmployeeFieldVisibility(
  settings?: TenantSettingsDto | null,
  audience: EmployeeFieldAudience = "hrAdmin"
): EmployeeFieldVisibility {
  const policy = getEmployeeFieldPolicy(settings, audience);

  return {
    showHireDate: policy.showHireDate,
    showJobTitle: policy.showJobTitle,
    showPhone: policy.showPhone,
    showWorkLocation: policy.showWorkLocation,
    showEmploymentType: policy.showEmploymentType,
  };
}

export function useEmployeeFieldPolicy(
  enabled: boolean,
  audience: EmployeeFieldAudience = "hrAdmin"
): EmployeeFieldPolicyState {
  const { data: settings } = useTenantSettings(enabled);

  return useMemo(
    () => getEmployeeFieldPolicy(settings, audience),
    [audience, settings]
  );
}

export function useEmployeeFieldVisibility(
  enabled: boolean,
  audience: EmployeeFieldAudience = "hrAdmin"
): EmployeeFieldVisibility {
  const policy = useEmployeeFieldPolicy(enabled, audience);

  return useMemo(
    () => ({
      showHireDate: policy.showHireDate,
      showJobTitle: policy.showJobTitle,
      showPhone: policy.showPhone,
      showWorkLocation: policy.showWorkLocation,
      showEmploymentType: policy.showEmploymentType,
    }),
    [
      policy.showEmploymentType,
      policy.showHireDate,
      policy.showJobTitle,
      policy.showPhone,
      policy.showWorkLocation,
    ]
  );
}
