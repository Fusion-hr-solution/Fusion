"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { visibleFusionModules } from "../fusion-navigation";
import {
  createFusionSettingsApi,
  FUSION_SETTINGS_MODULES,
  fusionSettingsQueryKeys,
  readSettingsReturn,
  youSections,
  type FieldVisibility,
  type FusionSettingsApi,
  type FusionSettingsGroupKey,
  type FusionSettingsSection,
  type NotificationPreferences,
  type SettingsReturn,
  type UpdateNotificationPreferencesRequest,
} from "../fusion-settings";
import { createPlatformApiClient } from "../platform";
import { useFusionViewer } from "../react/fusion-viewer";

export type FusionSettingsGroupStatus = "loading" | "ready" | "error";

/** One group of the settings-mode sidebar: You, or a module the person can view a section of. */
export interface FusionSettingsGroup {
  key: FusionSettingsGroupKey;
  label: string;
  status: FusionSettingsGroupStatus;
  sections: FusionSettingsSection[];
  /** Every section in the group is view-only. */
  viewOnly: boolean;
  /** Asks a group that didn't load again. */
  retry?: () => void;
}

export interface UseFusionSettingsOptions {
  /** Injected for tests. */
  api?: FusionSettingsApi;
  /** Off outside Settings, so module pages don't ask for sections they don't show. */
  enabled?: boolean;
}

function useSettingsApi(api?: FusionSettingsApi): FusionSettingsApi {
  return useMemo(() => api ?? createFusionSettingsApi(createPlatformApiClient()), [api]);
}

/**
 * The groups of Fusion Settings for the signed-in person: You first, then each module that answers with at least
 * one section. Each module is asked on its own, so one that fails becomes that group's "Didn't load" while the
 * others stay usable. A platform administrator has no tenant: Preferences only.
 */
export function useFusionSettings(options: UseFusionSettingsOptions = {}): {
  pending: boolean;
  groups: FusionSettingsGroup[];
} {
  const { viewer, isLoading } = useFusionViewer();
  const api = useSettingsApi(options.api);
  const tenantId = viewer?.tenantId ?? null;
  const modules = useMemo(() => {
    const visible = new Set(visibleFusionModules(viewer).map((entry) => entry.key));
    return tenantId && options.enabled !== false ? FUSION_SETTINGS_MODULES.filter((module) => visible.has(module.key)) : [];
  }, [viewer, tenantId, options.enabled]);

  const queries = useQueries({
    queries: modules.map((module) => ({
      queryKey: fusionSettingsQueryKeys.sections(module.key, tenantId),
      queryFn: ({ signal }: { signal: AbortSignal }) => api.getSections(module.key, signal),
      retry: false,
      staleTime: 60_000,
    })),
  });

  const groups: FusionSettingsGroup[] = [
    { key: "you", label: "You", status: "ready", sections: youSections(Boolean(tenantId)), viewOnly: false },
  ];
  modules.forEach((module, index) => {
    const query = queries[index]!;
    const status: FusionSettingsGroupStatus = query.isError ? "error" : query.isPending ? "loading" : "ready";
    const sections = [...(query.data ?? [])].sort((a, b) => a.order - b.order);
    if (status === "ready" && sections.length === 0) return;
    groups.push({
      key: module.key,
      label: module.label,
      status,
      sections,
      viewOnly: sections.length > 0 && sections.every((section) => section.access === "view"),
      retry: status === "error" ? () => void query.refetch() : undefined,
    });
  });

  return { pending: isLoading, groups };
}

/** One module's sections, for its own pages (the access and last change of the open section). */
export function useSettingsSections(module: "core" | "performance", options: UseFusionSettingsOptions = {}) {
  const { viewer } = useFusionViewer();
  const api = useSettingsApi(options.api);
  const tenantId = viewer?.tenantId ?? null;
  return useQuery({
    queryKey: fusionSettingsQueryKeys.sections(module, tenantId),
    queryFn: ({ signal }) => api.getSections(module, signal),
    enabled: Boolean(tenantId),
    retry: false,
    staleTime: 60_000,
  });
}

/** The person's own Performance notification choices. */
export function useNotificationPreferences(options: UseFusionSettingsOptions = {}) {
  const { viewer } = useFusionViewer();
  const api = useSettingsApi(options.api);
  return useQuery<NotificationPreferences>({
    queryKey: fusionSettingsQueryKeys.notificationPreferences(viewer?.tenantId ?? null, viewer?.userId ?? null),
    queryFn: ({ signal }) => api.getNotificationPreferences(signal),
    enabled: Boolean(viewer?.tenantId),
    retry: false,
  });
}

/** Saves the person's email choices; the response replaces the cached choices. */
export function useUpdateNotificationPreferences(options: UseFusionSettingsOptions = {}) {
  const { viewer } = useFusionViewer();
  const api = useSettingsApi(options.api);
  const client = useQueryClient();
  const key = fusionSettingsQueryKeys.notificationPreferences(viewer?.tenantId ?? null, viewer?.userId ?? null);
  return useMutation({
    mutationFn: (request: UpdateNotificationPreferencesRequest) => api.updateNotificationPreferences(request),
    onSuccess: (saved) => client.setQueryData(key, saved),
  });
}

/** Core HR's field policy, which every profile applies. Needs no settings permission. */
export function useFieldVisibility(options: UseFusionSettingsOptions & { enabled?: boolean } = {}) {
  const { viewer } = useFusionViewer();
  const api = useSettingsApi(options.api);
  return useQuery<FieldVisibility>({
    queryKey: fusionSettingsQueryKeys.fieldVisibility(viewer?.tenantId ?? null),
    queryFn: ({ signal }) => api.getFieldVisibility(signal),
    enabled: (options.enabled ?? true) && Boolean(viewer?.tenantId),
    staleTime: 5 * 60_000,
  });
}

/**
 * Where "Back to …" leads, read once in the browser: the page the person came from, else Home, or the Platform
 * console for a platform administrator.
 */
export function useSettingsReturn(): SettingsReturn {
  const { viewer } = useFusionViewer();
  const platformAdministrator = viewer !== null && !viewer.tenantId;
  const [value, setValue] = useState<SettingsReturn>({ href: "/", label: "Home" });
  useEffect(() => {
    setValue(readSettingsReturn(window.sessionStorage, { platformAdministrator }));
  }, [platformAdministrator]);
  return value;
}

/** Who saved first, for the save bar's conflict line. */
export interface SettingsConflictSaver {
  actorName: string;
  at: string;
  section: string;
}

/**
 * When a save is refused because someone saved first, asks the module for its sections again and names the latest
 * change among `sectionIds` (sections sharing one record, like Performance's cycle settings, conflict together).
 */
export function useSettingsConflictSaver(
  module: "core" | "performance",
  sectionIds: readonly string[],
  conflict: boolean,
  options: UseFusionSettingsOptions = {},
): SettingsConflictSaver | null {
  const sections = useSettingsSections(module, options);
  const { refetch } = sections;
  useEffect(() => {
    if (conflict) void refetch();
  }, [conflict, refetch]);
  if (!conflict || sections.isFetching) return null;
  const latest = (sections.data ?? [])
    .filter((section) => sectionIds.includes(section.id) && section.lastChange)
    .sort((a, b) => b.lastChange!.at.localeCompare(a.lastChange!.at))[0];
  return latest?.lastChange ? { actorName: latest.lastChange.actorName, at: latest.lastChange.at, section: latest.label } : null;
}
