"use client";

import { useEffect } from "react";
import { useAuth } from "@repo/auth";
import { SettingsFrame } from "@/features/settings/settings-frame";
import { Notifications } from "@/features/settings/notifications";

export default function NotificationsPage() {
  const { user, isLoading } = useAuth();
  // A platform administrator belongs to no tenant, so there is nothing to be notified of: Preferences only.
  const tenantless = !isLoading && Boolean(user) && !user?.tenantId;
  useEffect(() => {
    if (tenantless) window.location.replace("/settings");
  }, [tenantless]);

  return (
    <SettingsFrame trail={["Notifications"]}>{tenantless ? null : <Notifications />}</SettingsFrame>
  );
}
