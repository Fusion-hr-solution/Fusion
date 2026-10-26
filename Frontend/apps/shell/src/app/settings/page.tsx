"use client";

import { useTranslations } from "next-intl";
import { SettingsFrame } from "@/features/settings/settings-frame";
import { Preferences } from "@/features/settings/preferences";

export default function PreferencesPage() {
  const t = useTranslations("settings.preferences");
  return (
    <SettingsFrame trail={[t("title")]}>
      <Preferences />
    </SettingsFrame>
  );
}
