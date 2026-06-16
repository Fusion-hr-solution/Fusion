import { describe, expect, it } from "vitest";
import {
  normalizeSettingsSectionId,
  SETTINGS_SECTION_IDS,
} from "./settings-registry";

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
    expect(normalizeSettingsSectionId("unknown")).toBeNull();
  });
});
