"use client";

import { SettingsFrame } from "@/features/settings/settings-frame";
import { Preferences } from "@/features/settings/preferences";

export default function PreferencesPage() {
  return (
    <SettingsFrame trail={["Preferences"]}>
      <Preferences />
    </SettingsFrame>
  );
}
