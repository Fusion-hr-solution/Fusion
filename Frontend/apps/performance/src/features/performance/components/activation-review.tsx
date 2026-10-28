"use client";

import { reportPerformanceFailure } from "@/features/performance/api/performance-failure";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { CycleDetailDto } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ds/components/ui/dialog";
import { AsyncButton } from "@repo/ds/shell";
import { useTranslations } from "next-intl";
import { useFormat } from "@repo/ds/lib/use-format";

/**
 * Activation is consequential, so it is confirmed — but it is a commitment, not a
 * destruction, so it states plainly what it opens and what it locks. No decorative
 * illustration; the facts carry the weight.
 */
export function ActivationReview({
  open,
  onOpenChange,
  detail,
  onActivate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: CycleDetailDto;
  onActivate: () => Promise<void>;
}) {
  const format = useFormat();
  const t = useTranslations("cycleSetup.ActivationReview");
  const [submitting, setSubmitting] = useState(false);

  const locked: { label: string; value: ReactNode }[] = [
    {
      label: t("population"),
      value: (
        <>
          <span className="font-semibold tabular-nums text-primary-ink">
            {detail.confirmedParticipantCount}
          </span>{t("peopleFrozenAsTheRoster")}
        </>
      ),
    },
    { label: t("settings"), value: "Locked to this Cycle" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("activate", { name: detail.cycle.name })}</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">
              {t("planningOpensThrough", { planningDeadline: format.date(detail.cycle.planningDeadline) })}
            </span>{t("theseLockIntoTheCycle")}
          </DialogDescription>
        </DialogHeader>

        <dl className="divide-y divide-border border-y border-border">
          {locked.map((item) => (
            <div key={item.label} className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="type-label text-foreground">{item.label}</dt>
              <dd className="text-end type-body text-muted-foreground">{item.value}</dd>
            </div>
          ))}
        </dl>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t("cancel")}
          </Button>
          <AsyncButton
            pending={submitting}
            pendingLabel={t("activating")}
            onClick={async () => {
              setSubmitting(true);
              try {
                await onActivate();
                toast.success(t("isNowActivePlanningIs", { name: detail.cycle.name }));
                onOpenChange(false);
              } catch (error) {
                reportPerformanceFailure(error, t("activationFailed"));
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {t("activateCycle")}
          </AsyncButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
