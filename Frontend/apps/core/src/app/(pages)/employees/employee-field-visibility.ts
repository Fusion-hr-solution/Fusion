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
  | "jobTitle";

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
  requireHireDate: boolean;
  requireJobTitle: boolean;
}

export interface EmployeeFieldVisibility {
  showHireDate: boolean;
  showJobTitle: boolean;
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
    surface: "prepared",
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
  settings?: TenantSettingsDto | null
): EmployeeFieldPolicyState {
  const config = buildEmployeeFieldConfigDraft(settings);

  const fields = EMPLOYEE_FIELD_DEFINITIONS.reduce(
    (map, field) => {
      map[field.key] = {
        ...config[field.key],
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
    requireHireDate: fields.hireDate.required,
    requireJobTitle: fields.jobTitle.required,
  };
}

export function getEmployeeFieldVisibility(
  settings?: TenantSettingsDto | null
): EmployeeFieldVisibility {
  const policy = getEmployeeFieldPolicy(settings);

  return {
    showHireDate: policy.showHireDate,
    showJobTitle: policy.showJobTitle,
  };
}

export function useEmployeeFieldPolicy(
  enabled: boolean
): EmployeeFieldPolicyState {
  const { data: settings } = useTenantSettings(enabled);

  return useMemo(() => getEmployeeFieldPolicy(settings), [settings]);
}

export function useEmployeeFieldVisibility(
  enabled: boolean
): EmployeeFieldVisibility {
  const policy = useEmployeeFieldPolicy(enabled);

  return useMemo(
    () => ({
      showHireDate: policy.showHireDate,
      showJobTitle: policy.showJobTitle,
    }),
    [policy.showHireDate, policy.showJobTitle]
  );
}
