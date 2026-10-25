import { CoreSettingsIndex } from "@/features/settings/section-host";

export const dynamic = "force-dynamic";

/** `/core/settings` opens the person's first Core HR settings section. */
export default function SettingsPage() {
  return <CoreSettingsIndex />;
}
