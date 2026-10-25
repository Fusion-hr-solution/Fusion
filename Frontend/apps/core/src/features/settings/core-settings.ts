/** Core HR's sections in Fusion Settings, in order (the server decides which a person sees). */
export const CORE_SETTINGS_SECTIONS = [
  { id: "company", label: "Company" },
  { id: "employee-fields", label: "Employee fields" },
  { id: "roles", label: "Roles" },
  { id: "invitations", label: "Invitations" },
  { id: "change-history", label: "Change history" },
] as const;

export type CoreSettingsSectionId = (typeof CORE_SETTINGS_SECTIONS)[number]["id"];

export function isCoreSettingsSectionId(value: string): value is CoreSettingsSectionId {
  return CORE_SETTINGS_SECTIONS.some((section) => section.id === value);
}

export function coreSettingsLabel(id: string): string {
  return CORE_SETTINGS_SECTIONS.find((section) => section.id === id)?.label ?? "Settings";
}

/** Change history's section filter names the section an audit entry belongs to. */
export const AUDIT_SECTION_LABELS: Record<string, string> = {
  organization: "Company",
  "people-data": "Employee fields",
  provisioning: "Invitations",
  "access-permissions": "Roles",
  roles: "Roles",
};
