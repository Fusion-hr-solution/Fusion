"use client";

import { useTranslations } from "next-intl";
import { Button } from "@repo/ds";
import { Spinner } from "@repo/ds";
import { AlertTriangle, RotateCcw } from "lucide-react";
import type { WorkforceApplyStatusDto } from "@repo/api";

const PHASES = new Set(["Preparing", "Validating", "Saving", "Saved"]);

/**
 * Applying state — real, honest progress. Only real phases/counters; never "N added"
 * before the atomic commit. Refresh restores this state (the operation is server-side).
 */
export function WorkforceApplyState({
  status,
  onReturnToReview,
  onRetry,
}: {
  status: WorkforceApplyStatusDto;
  onReturnToReview: () => void;
  onRetry: () => void;
}) {
  const t = useTranslations("wfImport.apply");
  if (status.status === "Failed") {
    return (
      <Centered>
        <AlertTriangle className="size-6 text-[var(--color-warning)]" aria-hidden />
        <h2 className="mt-3 type-section-title text-foreground">{t("failedTitle")}</h2>
        <p className="mt-1 type-body text-muted-foreground">{t("failedDescription")}</p>
        <div className="mt-5 flex items-center gap-3">
          <Button onClick={onRetry}>
            <RotateCcw className="size-4" aria-hidden /> {t("retry")}
          </Button>
          <Button variant="ghost" onClick={onReturnToReview} className="text-muted-foreground">
            {t("returnToReview")}
          </Button>
        </div>
      </Centered>
    );
  }

  const phase = PHASES.has(status.phase) ? t(`phase.${status.phase}` as "phase.Saving") : t("completing");
  return (
    <Centered>
      <Spinner className="size-6 text-primary-ink" />
      <h2 className="mt-4 type-section-title text-foreground">{t("completing")}</h2>
      <p className="mt-1 type-body text-muted-foreground">{phase}</p>
      {status.total ? (
        <p className="mt-2 type-meta text-muted-foreground tabular-nums">
          {t("processed", { processed: status.processed, total: status.total })}
        </p>
      ) : null}
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  // Fills the shell's flex body so the state is centered on both axes of the page,
  // not within a narrow left-aligned content column.
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-8">
      <div className="flex max-w-sm flex-col items-center text-center">{children}</div>
    </div>
  );
}
