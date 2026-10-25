"use client";

import { useMemo } from "react";
import {
  createFusionNavigationApi,
  createPlatformApiClient,
  fusionNavigationQueryKeys,
  visibleFusionModules,
  type FusionSettingsSection,
} from "@repo/api";
import { useApiQuery } from "@repo/api/query";
import { useFusionViewer } from "@repo/api/react";
import {
  FUSION_MODULE_ICONS,
  PageError,
  SettingsBlock,
  SettingsPage,
  SettingsRow,
  SettingsRows,
  SettingsValue,
} from "@repo/ds/shell";

/** "English (United States)" for "en-US"; the code itself when the browser can't name it. */
export function languageName(locale: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "language", languageDisplay: "standard" }).of(locale) ?? locale;
  } catch {
    return locale;
  }
}

/** "Africa/Tunis · UTC+1": the zone and its current offset. */
export function timeZoneLabel(timeZone: string, now: Date = new Date()): string {
  try {
    const offset = new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "shortOffset" })
      .formatToParts(now)
      .find((part) => part.type === "timeZoneName")?.value;
    return offset ? `${timeZone} · ${offset.replace("GMT", "UTC") || "UTC"}` : timeZone;
  } catch {
    return timeZone;
  }
}

/**
 * Settings › Company: the tenant's facts as text, set when it joined Fusion and changed by the Fusion provider, and
 * the modules that are on. Nothing here is editable.
 */
export function CompanySettings({ section }: { section: FusionSettingsSection }) {
  const { viewer } = useFusionViewer();
  const api = useMemo(() => createFusionNavigationApi(createPlatformApiClient()), []);
  const tenant = useApiQuery(
    [...fusionNavigationQueryKeys.tenant(viewer?.tenantId ?? "none"), "facts"],
    (signal) => api.getTenant(signal),
    { enabled: Boolean(viewer?.tenantId) }
  );
  const modules = useMemo(
    () => visibleFusionModules(viewer).filter((module) => module.entitlement),
    [viewer]
  );

  if (tenant.error) {
    return (
      <SettingsPage title={section.label}>
        <PageError title="Company details didn't load" onRetry={() => void tenant.refetch()} />
      </SettingsPage>
    );
  }

  const facts = tenant.data;
  return (
    <SettingsPage
      title={section.label}
      note={facts ? `Set when ${facts.name} joined Fusion. Your Fusion provider changes these.` : undefined}
      loading={!facts}
    >
      {facts ? (
        <>
          <SettingsRows>
            <SettingsRow label="Company name">
              <SettingsValue>{facts.name}</SettingsValue>
            </SettingsRow>
            {facts.slug ? (
              <SettingsRow label="Workspace address">
                <SettingsValue className="type-code">{facts.slug}</SettingsValue>
              </SettingsRow>
            ) : null}
            {facts.industry ? (
              <SettingsRow label="Industry">
                <SettingsValue>{facts.industry}</SettingsValue>
              </SettingsRow>
            ) : null}
            {facts.locale ? (
              <SettingsRow label="Language and formats" description="Dates, numbers and emails Fusion sends">
                <SettingsValue>{languageName(facts.locale)}</SettingsValue>
              </SettingsRow>
            ) : null}
            {facts.timeZone ? (
              <SettingsRow label="Time zone" description="Deadlines and reminders follow it">
                <SettingsValue>{timeZoneLabel(facts.timeZone)}</SettingsValue>
              </SettingsRow>
            ) : null}
          </SettingsRows>

          <SettingsBlock title="Modules" meta={`${modules.length} on`}>
            <ul className="grid gap-3 sm:grid-cols-2">
              {modules.map((module) => {
                const Icon = FUSION_MODULE_ICONS[module.key];
                return (
                  <li key={module.key} className="flex items-center gap-3 rounded-surface border border-border bg-card px-4 py-3.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-control bg-primary-tint text-primary-ink">
                      {Icon ? <Icon aria-hidden className="size-4" /> : null}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="type-label font-semibold text-foreground">{module.label}</span>
                      <span className="truncate type-meta text-muted-foreground">{module.description}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </SettingsBlock>
        </>
      ) : null}
    </SettingsPage>
  );
}
