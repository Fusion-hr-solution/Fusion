"use client";

import { ImportStepper, type ImportStep } from "./import-stepper";

/**
 * The one header of an import, identical on Upload, Match and Review so moving between stages
 * reads as the same journey advancing. Shared by every import domain; only the title, the context
 * line (a description before an attempt exists, the file and as-of date after) and the actions change.
 */
export function ImportHeader({
  title = "Import organization structure",
  steps,
  context,
  actions,
}: {
  title?: string;
  steps: ImportStep[];
  context: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-10 gap-y-6">
      <div className="min-w-0 max-w-2xl">
        <h1 className="type-display text-foreground">{title}</h1>
        <div className="mt-2 type-body text-muted-foreground">{context}</div>
      </div>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
        <ImportStepper steps={steps} />
        {actions ? <div className="flex items-center gap-1 pt-0.5">{actions}</div> : null}
      </div>
    </header>
  );
}
