"use client";

import { RotateCw, Sparkles } from "lucide-react";
import { Button, Spinner } from "@repo/ds";
import type { OrganizationImportSemanticAssistance } from "@repo/api";
import { describeAssistance } from "../model/match-assistance";

/** The one automatic-matching action the banner can offer, or the in-flight state. */
export function ImportMatchAssistance({
  assistance,
  needsReview,
  running,
  onRun,
}: {
  assistance: OrganizationImportSemanticAssistance | null;
  needsReview: number;
  running: boolean;
  onRun: (grantConsent: boolean) => void;
}) {
  if (running)
    return (
      <p className="mt-3 flex items-center gap-2 type-meta text-muted-foreground" role="status">
        <Spinner className="size-3.5" aria-hidden />
        Matching with AI…
      </p>
    );
  const { action } = describeAssistance(assistance, needsReview);
  if (!action) return null;
  const Icon = action.retry ? RotateCw : Sparkles;
  return (
    <Button size="sm" className="mt-3" onClick={() => onRun(action.grantConsent)}>
      <Icon aria-hidden />
      {action.label}
    </Button>
  );
}
