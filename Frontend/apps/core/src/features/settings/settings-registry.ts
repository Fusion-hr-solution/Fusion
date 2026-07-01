export const SETTINGS_SECTION_IDS = {
  overview: "overview",
  organization: "organization",
  peopleData: "people-data",
  structure: "structure",
  accessPermissions: "access-permissions",
  provisioning: "provisioning",
  governance: "governance",
} as const;

export type SettingsSectionId =
  (typeof SETTINGS_SECTION_IDS)[keyof typeof SETTINGS_SECTION_IDS];

const LEGACY_SETTINGS_SECTION_ALIASES: Record<string, SettingsSectionId> = {
  "employee-fields": SETTINGS_SECTION_IDS.peopleData,
  "organization-structure": SETTINGS_SECTION_IDS.structure,
  "access-profiles": SETTINGS_SECTION_IDS.accessPermissions,
};

export function normalizeSettingsSectionId(
  value: string | null | undefined
): SettingsSectionId | null {
  if (!value) {
    return null;
  }

  const canonical = Object.values(SETTINGS_SECTION_IDS).find(
    (sectionId) => sectionId === value
  );

  if (canonical) {
    return canonical;
  }

  return LEGACY_SETTINGS_SECTION_ALIASES[value] ?? null;
}
