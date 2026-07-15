"use client";

import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@repo/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@repo/ui";
import { useTranslations } from "next-intl";
import type { EnrollInSessionsResult } from "@/types";

interface EnrollmentResultDialogProps {
  result: EnrollInSessionsResult | null;
  trainingTitle?: string;
  open: boolean;
  onClose: () => void;
}

export function EnrollmentResultDialog({ result, trainingTitle, open, onClose }: EnrollmentResultDialogProps) {
  const t = useTranslations("trainingDetail.sessions.result");
  if (!result) return null;

  const enrolled = result.enrollments.filter((e) => e.status === "Enrolled");
  const waitlisted = result.enrollments.filter((e) => e.status === "Waitlisted");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {waitlisted.length === 0 ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-[hsl(var(--ey-green-500))]" />
                {t("confirmedTitle")}
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-[hsl(var(--ey-orange-500))]" />
                {t("submittedTitle")}
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {trainingTitle && (
            <p className="text-sm text-foreground font-medium">{trainingTitle}</p>
          )}

          {enrolled.length > 0 && (
            <div className="rounded-lg border border-[hsl(var(--ey-green-500))]/25 bg-[hsl(var(--ey-green-500))]/15 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--ey-green-500))]">
                <CheckCircle2 className="h-4 w-4" />
                {t("confirmedCount", { count: enrolled.length })}
              </div>
              <p className="mt-1 text-xs text-[hsl(var(--ey-green-500))]">
                {t("confirmedDesc")}
              </p>
            </div>
          )}

          {waitlisted.length > 0 && (
            <div className="rounded-lg border border-[hsl(var(--ey-orange-500))]/25 bg-[hsl(var(--ey-orange-500))]/15 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--ey-orange-500))]">
                <Clock className="h-4 w-4" />
                {t("waitlistedCount", { count: waitlisted.length })}
              </div>
              <p className="mt-1 text-xs text-[hsl(var(--ey-orange-500))]">
                {t("waitlistedDesc", {
                  positions: waitlisted
                    .map((w) => t("position", { position: w.waitlistPosition }))
                    .join(", "),
                })}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="w-full">
            {t("gotIt")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
