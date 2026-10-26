import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { DevelopmentGoalStatus, ObjectiveStatus, RosterPlanStatus } from "@repo/api";
import { useFormat } from "@repo/ds/lib/use-format";
import type { StatusMix } from "./objective-status";
import type { ReviewStep } from "./summary-lib";

/**
 * The shared Performance words in the person's language: states, review steps, a status mix, names joined into a
 * sentence and praise times. The host app merges `performanceUi` into its catalogue (`@repo/performance-ui/i18n`).
 */
export function usePerformanceWords() {
  const t = useTranslations("performanceUi.words");
  const format = useFormat();
  return useMemo(() => {
    const praiseTime = (iso: string, now: Date = new Date()) => {
      const at = new Date(iso);
      const minutes = Math.round((now.getTime() - at.getTime()) / 60_000);
      if (minutes < 1) return t("justNow");
      if (minutes < 60) return t("minutesAgo", { count: minutes });
      const hours = Math.round(minutes / 60);
      if (hours < 24 && at.getDate() === now.getDate()) return t("hoursAgo", { count: hours });
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      if (at.toDateString() === yesterday.toDateString()) return t("yesterday");
      return format.parts(at, { day: "numeric", month: "short", ...(at.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }) });
    };
    return {
      /** Any other line of `performanceUi.words`. */
      t,
      objectiveStatus: (status: ObjectiveStatus) => t(`objectiveStatus.${status}`),
      planStatus: (status: RosterPlanStatus) => t(`planStatus.${status}`),
      developmentStatus: (status: DevelopmentGoalStatus) => t(`developmentStatus.${status}`),
      step: (step: ReviewStep) => t(`step.${step}`),
      statusMix: (mix: StatusMix) =>
        (
          [
            [mix.onTrack, "onTrack"],
            [mix.atRisk, "atRisk"],
            [mix.offTrack, "offTrack"],
            [mix.notReported, "notReported"],
          ] as const
        )
          .filter(([count]) => count > 0)
          .map(([count, key]) => t(`mix.${key}`, { count }))
          .join(" · "),
      joinNames: (names: readonly (string | null)[]) => {
        const clean = names.map((name) => name ?? t("aColleague"));
        if (clean.length <= 1) return clean[0] ?? "";
        return t("namesAnd", { first: clean.slice(0, -1).join(", "), last: clean[clean.length - 1]! });
      },
      praiseTime,
      date: (iso: string) => format.date(iso.slice(0, 10)),
      dateTime: format.dateTime,
    };
  }, [t, format]);
}
