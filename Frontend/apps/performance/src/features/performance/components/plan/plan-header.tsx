"use client";

import type { EmployeePlanDto } from "@repo/api";
import { StatusBadge } from "@repo/ds/shell";
import { useTranslations } from "next-intl";

/**
 * The plan's lifecycle state as a chip beside the page title. Draft is filled in the theme's opposite —
 * the plan is yours to shape, not a warning — while a submitted or approved plan takes the semantic tone.
 */
export function PlanStateBadge({ plan }: { plan: EmployeePlanDto }) {
  const t = useTranslations("plan.PlanStateBadge");
  if (plan.state === "Draft") {
    return (
      <StatusBadge tone="inverse" dot>
        {t("draft")}
      </StatusBadge>
    );
  }
  return (
    <StatusBadge tone={plan.state === "Submitted" ? "warning" : "success"} dot>
      {plan.state === "Submitted" ? t("submitted") : t("approved")}
    </StatusBadge>
  );
}

/** The not-started state as a quiet neutral chip, before any plan exists to carry a lifecycle tone. */
export function NotStartedBadge() {
  const t = useTranslations("plan.NotStartedBadge");
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      <span className="size-1.5 rounded-full bg-muted-foreground/50" aria-hidden />
      {t("notStarted")}
    </span>
  );
}
