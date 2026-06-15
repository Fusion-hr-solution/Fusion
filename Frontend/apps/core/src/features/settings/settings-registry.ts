export type SettingsSectionGroup = "foundation" | "module";
export type SettingsSectionStatus = "ready" | "attention" | "disabled";

export interface SettingsSectionRegistration {
  id: string;
  moduleId: string;
  group: SettingsSectionGroup;
  label: string;
  description: string;
  href: string;
  requiredPermissions?: string[];
  requiredAnyPermissions?: string[];
  enabled: boolean;
  status: SettingsSectionStatus;
  statusLabel: string;
  owner: string;
  auditNamespace: string;
  order: number;
}

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

export const SETTINGS_SECTION_REGISTRATIONS: SettingsSectionRegistration[] = [
  {
    id: SETTINGS_SECTION_IDS.overview,
    moduleId: "core",
    group: "foundation",
    label: "Overview",
    description: "Visible administration areas, health, and recent changes.",
    href: `/settings?tab=${SETTINGS_SECTION_IDS.overview}`,
    requiredAnyPermissions: [
      "settings.organization.view",
      "settings.organization.manage",
      "settings.peopleData.view",
      "settings.peopleData.manage",
      "settings.structure.view",
      "settings.structure.manage",
      "settings.provisioning.view",
      "settings.provisioning.manage",
      "settings.governance.view",
      "access.profiles.view",
      "access.profiles.manage",
      "core.settings.view",
      "core.settings.manage",
      "core.accessprofiles.manage",
    ],
    enabled: true,
    status: "ready",
    statusLabel: "Core",
    owner: "Core",
    auditNamespace: "core.settings.overview",
    order: 0,
  },
  {
    id: SETTINGS_SECTION_IDS.organization,
    moduleId: "core",
    group: "foundation",
    label: "Organization",
    description: "Company basics and stable branding.",
    href: `/settings?tab=${SETTINGS_SECTION_IDS.organization}`,
    requiredAnyPermissions: [
      "settings.organization.view",
      "settings.organization.manage",
      "core.settings.view",
      "core.settings.manage",
    ],
    enabled: true,
    status: "ready",
    statusLabel: "Core",
    owner: "Core",
    auditNamespace: "core.settings.organization",
    order: 10,
  },
  {
    id: SETTINGS_SECTION_IDS.peopleData,
    moduleId: "core",
    group: "foundation",
    label: "People data",
    description: "Employee field policy and self-service profile edits.",
    href: `/settings?tab=${SETTINGS_SECTION_IDS.peopleData}`,
    requiredAnyPermissions: [
      "settings.peopleData.view",
      "settings.peopleData.manage",
      "core.settings.view",
      "core.settings.manage",
    ],
    enabled: true,
    status: "ready",
    statusLabel: "Core",
    owner: "Core",
    auditNamespace: "core.settings.people-data",
    order: 20,
  },
  {
    id: SETTINGS_SECTION_IDS.structure,
    moduleId: "core",
    group: "foundation",
    label: "Organization structure",
    description: "Org-unit kinds and structure schema governance.",
    href: `/settings?tab=${SETTINGS_SECTION_IDS.structure}`,
    requiredAnyPermissions: [
      "settings.structure.view",
      "settings.structure.manage",
      "core.settings.view",
      "core.settings.manage",
    ],
    enabled: true,
    status: "ready",
    statusLabel: "Core",
    owner: "Core",
    auditNamespace: "core.settings.structure",
    order: 30,
  },
  {
    id: SETTINGS_SECTION_IDS.accessPermissions,
    moduleId: "identity",
    group: "foundation",
    label: "Access & permissions",
    description: "Access profile definitions and permission scope vocabulary.",
    href: `/settings?tab=${SETTINGS_SECTION_IDS.accessPermissions}`,
    requiredAnyPermissions: [
      "access.profiles.view",
      "access.profiles.manage",
      "core.accessprofiles.manage",
    ],
    enabled: true,
    status: "ready",
    statusLabel: "Identity",
    owner: "Identity",
    auditNamespace: "identity.access-profiles",
    order: 40,
  },
  {
    id: SETTINGS_SECTION_IDS.provisioning,
    moduleId: "core",
    group: "foundation",
    label: "Provisioning",
    description: "Invite defaults, default profiles, and expiry policy.",
    href: `/settings?tab=${SETTINGS_SECTION_IDS.provisioning}`,
    requiredAnyPermissions: [
      "settings.provisioning.view",
      "settings.provisioning.manage",
      "core.settings.view",
      "core.settings.manage",
    ],
    enabled: true,
    status: "ready",
    statusLabel: "Core",
    owner: "Core",
    auditNamespace: "core.settings.provisioning",
    order: 50,
  },
  {
    id: SETTINGS_SECTION_IDS.governance,
    moduleId: "core",
    group: "foundation",
    label: "Governance",
    description: "Sensitive-change history and audit trail.",
    href: `/settings?tab=${SETTINGS_SECTION_IDS.governance}`,
    requiredAnyPermissions: [
      "settings.governance.view",
      "core.settings.view",
      "core.settings.manage",
    ],
    enabled: true,
    status: "ready",
    statusLabel: "Audit",
    owner: "Core",
    auditNamespace: "core.settings.governance",
    order: 60,
  },
];

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

export function canAccessSettingsSection(
  section: SettingsSectionRegistration,
  options: {
    hasPermission: (permissionKey: string) => boolean;
    isTenantContext?: boolean;
  }
): boolean {
  if (!section.enabled) {
    return false;
  }

  if (section.requiredPermissions?.length) {
    return section.requiredPermissions.every(options.hasPermission);
  }

  if (section.requiredAnyPermissions?.length) {
    return section.requiredAnyPermissions.some(options.hasPermission);
  }

  return true;
}

export function getVisibleSettingsSections(
  sections: SettingsSectionRegistration[],
  options: {
    hasPermission: (permissionKey: string) => boolean;
    isTenantContext?: boolean;
  }
): SettingsSectionRegistration[] {
  return sections
    .filter((section) => canAccessSettingsSection(section, options))
    .slice()
    .sort((left, right) => left.order - right.order);
}
