"use client";

import { useCallback, useState } from "react";
import { useAuth } from "./auth-context";
import { loadAuth, persistAuth, saveNotificationAlerts, type NotificationAlerts } from "./auth-service";

/**
 * The signed-in person's pop-up and chime choices for new notifications, kept on their account (B-154). Both are on
 * until turned off. `save` writes the account first and only then the stored session, so every open tab follows.
 */
export function useNotificationAlerts(): {
  alerts: NotificationAlerts;
  save: (change: Partial<NotificationAlerts>) => Promise<void>;
  saving: boolean;
} {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const alerts: NotificationAlerts = {
    popups: user?.notificationPopups ?? true,
    sound: user?.notificationSound ?? true,
  };

  const save = useCallback(async (change: Partial<NotificationAlerts>) => {
    setSaving(true);
    try {
      const saved = await saveNotificationAlerts(change);
      const stored = loadAuth();
      if (stored) {
        persistAuth({
          ...stored,
          user: { ...stored.user, notificationPopups: saved.popups, notificationSound: saved.sound },
        });
      }
    } finally {
      setSaving(false);
    }
  }, []);

  return { alerts, save, saving };
}
