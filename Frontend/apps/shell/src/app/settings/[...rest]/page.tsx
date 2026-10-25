import { redirect } from "next/navigation";

/** An unknown settings address opens Preferences. */
export default function UnknownSettingsPage() {
  redirect("/settings");
}
