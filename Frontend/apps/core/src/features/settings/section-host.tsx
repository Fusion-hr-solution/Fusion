"use client";

import { useEffect, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { FusionSettingsSection } from "@repo/api";
import { useSettingsSections } from "@repo/api/query";
import { PageError, SettingsPage } from "@repo/ds/shell";
import { useCoreSettingsLabel } from "./core-settings";

/**
 * Opens one Core HR section once the server says the person may see it. A section they can't view, or an unknown
 * address, sends them to their first allowed section (Preferences when there is none).
 */
export function CoreSettingsSectionHost({
  id,
  render,
}: {
  id: string;
  render: (section: FusionSettingsSection) => ReactNode;
}) {
  const t = useTranslations("settings");
  const locale = useLocale();
  const coreSettingsLabel = useCoreSettingsLabel();
  const sections = useSettingsSections("core");
  const section = sections.data?.find((candidate) => candidate.id === id);
  const fallback = sections.data && !section ? (sections.data[0]?.path ?? "/settings") : null;

  useEffect(() => {
    if (fallback) window.location.replace(fallback);
  }, [fallback]);

  if (sections.isError) {
    return (
      <div lang={locale} className="contents">
        <SettingsPage title={coreSettingsLabel(id)}>
          <PageError title={t("didNotLoad")} onRetry={() => void sections.refetch()} />
        </SettingsPage>
      </div>
    );
  }
  // Translated sections mark their language: Core HR's other screens are still English (phase 3).
  return (
    <div lang={locale} className="contents">
      {section ? render(section) : <SettingsPage title={coreSettingsLabel(id)} loading />}
    </div>
  );
}

/** `/core/settings` opens the person's first Core HR section. */
export function CoreSettingsIndex() {
  const sections = useSettingsSections("core");
  const first = sections.data ? (sections.data[0]?.path ?? "/settings") : null;
  useEffect(() => {
    if (first) window.location.replace(first);
  }, [first]);
  return <SettingsPage title="Core HR" loading />;
}
