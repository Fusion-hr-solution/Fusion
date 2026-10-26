"use client";

import { reportPerformanceFailure } from "@/features/performance/api/performance-failure";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ds/components/ui/dialog";
import { Button } from "@repo/ds/components/ui/button";
import { Label } from "@repo/ds/components/ui/label";
import { Textarea } from "@repo/ds/components/ui/textarea";
import { AsyncButton } from "@repo/ds/shell";
import type { PopulationCandidateDto } from "@repo/api";
import { readinessIssueDetail } from "@/features/performance/lib";
import { primaryIssue } from "./population-model";
import { useTranslations } from "next-intl";
import type { Say } from "@/i18n/say";

const REASON_MAX = 240;

/** The candidate's blocking readiness issue, phrased as an exclusion reason; empty when healthy. */
export function issueReason(candidate: PopulationCandidateDto, eligibilityDate: string, say?: Say): string {
  const issue = primaryIssue(candidate);
  if (!issue) return "";
  const detail = readinessIssueDetail(issue.code, eligibilityDate, say);
  return detail ? `${issue.label}: ${detail}` : issue.label;
}

/**
 * Excluding a person from the cycle is a decision that must be justified — the reason is captured
 * with the exclusion and stays on record. Removing someone eligible without a reason is exactly
 * what this guards against.
 */
export function ExcludeDialog({
  name,
  defaultReason,
  confirmLabel,
  open,
  onOpenChange,
  onExclude,
}: {
  name: string | null;
  /** Prefills the reason, e.g. with the readiness issue that blocks the person. */
  defaultReason?: string;
  /** The confirm button's label; defaults to a singular exclude. Bulk passes "Exclude N employees". */
  confirmLabel?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExclude: (reason: string) => Promise<void>;
}) {
  const t = useTranslations("cycleSetup.ExcludeDialog");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setReason((defaultReason ?? "").slice(0, REASON_MAX));
      setPending(false);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- seed once per opening

  const trimmed = reason.trim();

  async function submit() {
    if (!trimmed) return;
    setPending(true);
    try {
      await onExclude(trimmed);
      onOpenChange(false);
    } catch (error) {
      reportPerformanceFailure(error, t("couldNotExcludeThisEmployee"));
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("exclude")} {name ?? t("thisEmployee")}?</DialogTitle>
          <DialogDescription>
            {t("theyWillNotParticipateIn")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="exclude-reason">
              {t("reason")} <span className="text-destructive" aria-hidden>*</span>
            </Label>
            <span className="type-meta tabular-nums text-muted-foreground">
              {reason.length}/{REASON_MAX}
            </span>
          </div>
          <Textarea
            id="exclude-reason"
            value={reason}
            maxLength={REASON_MAX}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder={t("eGOnExtendedLeave")}
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <AsyncButton pending={pending} disabled={!trimmed} onClick={submit} variant="destructive">
            {confirmLabel ?? t("excludeEmployee")}
          </AsyncButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
