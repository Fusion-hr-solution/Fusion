import { describe, expect, it } from "vitest";
import {
  getVisibleSettingsSections,
  normalizeSettingsSectionId,
  SETTINGS_SECTION_IDS,
  SETTINGS_SECTION_REGISTRATIONS,
} from "./settings-registry";

function visibleSectionIds(permissions: string[], isTenantContext = false) {
  return getVisibleSettingsSections(SETTINGS_SECTION_REGISTRATIONS, {
    hasPermission: (permissionKey) => permissions.includes(permissionKey),
    isTenantContext,
  }).map((section) => section.id);
}

describe("settings registry", () => {
  it("normalizes legacy tab ids to canonical section ids", () => {
    expect(normalizeSettingsSectionId("employee-fields")).toBe(
      SETTINGS_SECTION_IDS.peopleData
    );
    expect(normalizeSettingsSectionId("organization-structure")).toBe(
      SETTINGS_SECTION_IDS.structure
    );
    expect(normalizeSettingsSectionId("access-profiles")).toBe(
      SETTINGS_SECTION_IDS.accessPermissions
    );
    expect(normalizeSettingsSectionId("people-data")).toBe(
      SETTINGS_SECTION_IDS.peopleData
    );
  });

  it("shows Core foundation settings to settings viewers", () => {
    expect(visibleSectionIds(["core.settings.view"])).toEqual([
      SETTINGS_SECTION_IDS.overview,
      SETTINGS_SECTION_IDS.organization,
      SETTINGS_SECTION_IDS.peopleData,
      SETTINGS_SECTION_IDS.structure,
      SETTINGS_SECTION_IDS.provisioning,
      SETTINGS_SECTION_IDS.governance,
    ]);
  });

  it("shows overview and access permissions to profile definition managers", () => {
    expect(visibleSectionIds(["access.profiles.manage"])).toEqual([
      SETTINGS_SECTION_IDS.overview,
      SETTINGS_SECTION_IDS.accessPermissions,
    ]);
  });

  it("shows only delegated people data sections to people data admins", () => {
    expect(visibleSectionIds(["settings.peopleData.manage"])).toEqual([
      SETTINGS_SECTION_IDS.overview,
      SETTINGS_SECTION_IDS.peopleData,
    ]);
  });

  it("hides all sections without required access", () => {
    expect(visibleSectionIds([])).toEqual([]);
  });
});
