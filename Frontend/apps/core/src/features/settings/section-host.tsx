"use client";

import { useEffect, type ReactNode } from "react";
import type { FusionSettingsSection } from "@repo/api";
import { useSettingsSections } from "@repo/api/query";
import { PageError, SettingsPage } from "@repo/ds/shell";
import { coreSettingsLabel } from "./core-settings";

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
  const sections = useSettingsSections("core");
  const section = sections.data?.find((candidate) => candidate.id === id);
  const fallback = sections.data && !section ? (sections.data[0]?.path ?? "/settings") : null;

  useEffect(() => {
    if (fallback) window.location.replace(fallback);
  }, [fallback]);

  if (sections.isError) {
    return (
      <SettingsPage title={coreSettingsLabel(id)}>
        <PageError title="Core HR settings didn't load" onRetry={() => void sections.refetch()} />
      </SettingsPage>
    );
  }
  if (!section) return <SettingsPage title={coreSettingsLabel(id)} loading />;
  return <>{render(section)}</>;
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
