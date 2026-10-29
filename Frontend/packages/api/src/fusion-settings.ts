import { FUSION_MODULE_REGISTRY } from "./fusion-navigation";
import type { OrgChartSettingsDto, SelfServiceSettingsDto } from "./tenant-settings";
import type { ApiClient } from "./types";

// ── Fusion Settings (B-071) ──
//
// One Settings for everyone: a static You group, then a group per module the person can view a section of.
// Each module serves its own sections for the caller (SharedKernel `FusionSettingsSectionDto`); the list is
// advisory, and every read and write is checked again by the module.

export type FusionSettingsAccess = "view" | "manage";

/** Who last changed a section and when. `actorName` is "Someone" when the module couldn't resolve it. */
export interface FusionSettingsLastChange {
  at: string;
  actorName: string;
}

/** One section the caller may open (`GET /api/{module}/settings/sections`). */
export interface FusionSettingsSection {
  id: string;
  label: string;
  order: number;
  /** Absolute in-app path of the section's page. */
  path: string;
  access: FusionSettingsAccess;
  lastChange: FusionSettingsLastChange | null;
  /** When the section's record was created; shown while it was never changed. */
  setUpAt?: string | null;
}

export type FusionSettingsModuleKey = "core" | "performance";
export type FusionSettingsGroupKey = "you" | FusionSettingsModuleKey;

export const fusionSettingsPaths = {
  sections: (module: FusionSettingsModuleKey) =>
    module === "core" ? "/corehr/settings/sections" : "/performance/settings/sections",
  notificationPreferences: () => "/performance/notification-preferences",
  fieldVisibility: () => "/corehr/settings/field-visibility",
} as const;

export const fusionSettingsQueryKeys = {
  all: () => ["fusion-settings"] as const,
  sections: (module: FusionSettingsModuleKey, tenantId: string | null) =>
    [...fusionSettingsQueryKeys.all(), "sections", module, tenantId ?? "none"] as const,
  notificationPreferences: (tenantId: string | null, userId: string | null) =>
    [...fusionSettingsQueryKeys.all(), "notification-preferences", tenantId ?? "none", userId ?? "none"] as const,
  fieldVisibility: (tenantId: string | null) => [...fusionSettingsQueryKeys.all(), "field-visibility", tenantId ?? "none"] as const,
};

// ── The You group: the shell serves it, so it is static ──

export const PREFERENCES_PATH = "/settings";
export const NOTIFICATIONS_PATH = "/settings/notifications";

/**
 * Everyone has Preferences; a tenant member also has Notifications. A platform administrator has no tenant.
 * Labels here and in {@link YOU_GROUP_LABEL} are `@repo/ds` message keys: the sidebar shows them in the person's language.
 */
export const YOU_GROUP_LABEL = "settings.you";

export function youSections(hasTenant: boolean): FusionSettingsSection[] {
  const preferences: FusionSettingsSection = {
    id: "preferences",
    label: "settings.preferences",
    order: 1,
    path: PREFERENCES_PATH,
    access: "manage",
    lastChange: null,
  };
  if (!hasTenant) return [preferences];
  return [
    preferences,
    { id: "notifications", label: "settings.notifications", order: 2, path: NOTIFICATIONS_PATH, access: "manage", lastChange: null },
  ];
}

/** The modules that serve settings sections, in group order. */
export const FUSION_SETTINGS_MODULES: readonly { key: FusionSettingsModuleKey; label: string }[] = [
  { key: "core", label: "Core HR" },
  { key: "performance", label: "Performance" },
];

/** Whether a path is a settings page, of any module. */
export function isSettingsPath(path: string): boolean {
  return /^(\/core|\/performance)?\/settings(\/|$|\?)/.test(path);
}

// ── "Back to <module>": the page the person came from, kept for the browser session ──

export const SETTINGS_RETURN_KEY = "fusion.settings.back";

function isInAppPath(href: unknown): href is string {
  return typeof href === "string" && href.startsWith("/") && !href.startsWith("//") && !href.startsWith("/\\");
}

/** Remembers where Settings returns to. Settings pages themselves are never remembered. Never throws. */
export function rememberSettingsReturn(storage: Pick<Storage, "setItem"> | null | undefined, path: string): void {
  if (!isInAppPath(path) || isSettingsPath(path)) return;
  try {
    storage?.setItem(SETTINGS_RETURN_KEY, path);
  } catch {
    // A convenience only: without it, Back goes Home.
  }
}

export interface SettingsReturn {
  href: string;
  /** What "Back to …" names: the module of the path, or a `@repo/ds` message key for Home or the Platform console. */
  label: string;
}

/** Where "Back to …" leads: the remembered page, else Home (the Platform console for a platform administrator). */
export function readSettingsReturn(
  storage: Pick<Storage, "getItem"> | null | undefined,
  options: { platformAdministrator?: boolean } = {},
): SettingsReturn {
  let stored: string | null = null;
  try {
    stored = storage?.getItem(SETTINGS_RETURN_KEY) ?? null;
  } catch {
    stored = null;
  }
  const fallback = options.platformAdministrator ? "/platform" : "/";
  const href = isInAppPath(stored) && !isSettingsPath(stored) ? stored : fallback;
  return { href, label: settingsReturnLabel(href) };
}

export function settingsReturnLabel(path: string): string {
  const zone = path.split(/[/?#]/)[1] ?? "";
  if (zone === "platform") return "settings.place.platformConsole";
  return FUSION_MODULE_REGISTRY.find((entry) => entry.href === `/${zone}`)?.label ?? "settings.place.home";
}

// ── Notifications (Performance's groups, the caller's own email choices) ──

export type NotificationGroupKey =
  | "plans-and-goals"
  | "reviews-and-calibration"
  | "one-on-ones"
  | "feedback-and-praise"
  | "deadline-reminders";

export interface NotificationPreferenceItem {
  label: string;
  /** About the person's team rather than themselves. */
  team: boolean;
  /** Always emailed (deadline reminders). */
  always: boolean;
  /** How many notification kinds the line covers. */
  count: number;
}

export interface NotificationPreferenceGroup {
  key: NotificationGroupKey;
  label: string;
  summary: string;
  email: boolean;
  locked: boolean;
  count: number;
  items: NotificationPreferenceItem[];
}

export interface NotificationPreferences {
  emailAddress: string | null;
  groups: NotificationPreferenceGroup[];
  /** 0 before the person first saved. */
  version: number;
}

export interface UpdateNotificationPreferencesRequest {
  expectedVersion: number;
  emailOff: NotificationGroupKey[];
}

// ── Field visibility (Core HR's field policy, readable by every member) ──

export interface FieldVisibilityRule {
  required: boolean;
  visibleToEmployee: boolean;
  visibleToManager: boolean;
}

export interface FieldVisibility {
  fields: Record<string, FieldVisibilityRule>;
  selfService: SelfServiceSettingsDto;
  /** Who sees the org chart, so every surface can hide what leads to it. */
  orgChart: OrgChartSettingsDto;
}

export function createFusionSettingsApi(client: ApiClient) {
  return {
    getSections: (module: FusionSettingsModuleKey, signal?: AbortSignal) =>
      client.get<FusionSettingsSection[]>(fusionSettingsPaths.sections(module), { signal }),
    getNotificationPreferences: (signal?: AbortSignal) =>
      client.get<NotificationPreferences>(fusionSettingsPaths.notificationPreferences(), { signal }),
    updateNotificationPreferences: (request: UpdateNotificationPreferencesRequest) =>
      client.put<NotificationPreferences>(fusionSettingsPaths.notificationPreferences(), request),
    getFieldVisibility: (signal?: AbortSignal) =>
      client.get<FieldVisibility>(fusionSettingsPaths.fieldVisibility(), { signal }),
  };
}

export type FusionSettingsApi = ReturnType<typeof createFusionSettingsApi>;
