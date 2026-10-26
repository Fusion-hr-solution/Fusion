import { useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatDate, recencyOf } from "./dates";

type DateInput = string | Date | null | undefined;

/**
 * Recency for scanning in the person's language: "Just now", "12 min ago", "Yesterday" or "À l’instant",
 * "Il y a 12 min", "Hier", then the date. For translated screens; `formatRelative` is its English twin.
 */
export function useRelative(): (value: DateInput, now?: Date) => string {
  const t = useTranslations("ds.relative");
  const locale = useLocale();
  return useCallback(
    (value: DateInput, now: Date = new Date()) => {
      const recency = recencyOf(value, now);
      if (!recency) return "–";
      switch (recency.unit) {
        case "now":
          return t("now");
        case "minutes":
          return t("minutes", { count: recency.count });
        case "hours":
          return t("hours", { count: recency.count });
        case "yesterday":
          return t("yesterday");
        case "days":
          return t("days", { count: recency.count });
        case "date":
          return formatDate(recency.date, { now, locale });
      }
    },
    [t, locale],
  );
}
