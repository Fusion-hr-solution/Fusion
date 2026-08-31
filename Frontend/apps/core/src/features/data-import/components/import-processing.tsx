"use client";

import { useEffect, useState } from "react";
import { Check, FileSpreadsheet, Loader2, Sparkles } from "lucide-react";
import { cn } from "@repo/ds";
import type { ImportProcessingCopy } from "../model/import-descriptor";

export type ImportProcessingPhase = "uploading" | "interpreting" | "ready";

const DEFAULT_COPY: ImportProcessingCopy = {
  headlines: {
    uploading: "Reading your file",
    interpreting: "Interpreting your organization",
    ready: "Opening your review",
  },
  steps: [
    "Reading the file",
    "Detecting the layout",
    "Mapping your columns",
    "Resolving organization types",
    "Assembling the hierarchy",
    "Preparing your review",
  ],
};

// How long each interpret step dwells as the active line. The caller holds the interpret phase long
// enough to work through them; if it holds longer, the last interpret step simply stays active.
const STEP_INTERVAL_MS = 850;

/**
 * The staged hand-off between dropping a source and landing in the review. It replaces the dropzone
 * and communicates progress as a professional, determinate sequence — a filling bar and a checklist
 * of interpretation steps that tick from pending → working → done — so the transition reads as Fusion
 * deliberately working through the file rather than a dead spinner. The interpret steps advance on a
 * timer as an honest illusion of the interpretation that is really about to happen server-side; the
 * caller holds that phase long enough for the sequence to be seen.
 */
export function ImportProcessing({
  phase,
  fileName,
  copy = DEFAULT_COPY,
}: {
  phase: ImportProcessingPhase;
  fileName: string;
  copy?: ImportProcessingCopy;
}) {
  const steps = copy.steps.length >= 3 ? copy.steps : DEFAULT_COPY.steps;
  const lastInterpretStep = steps.length - 2;
  // activeStep spans the checklist: 0 = upload line, 1..(len-2) = interpret lines, len = all done.
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (phase === "uploading") {
      setActiveStep(0);
      return;
    }
    if (phase === "ready") {
      setActiveStep(steps.length);
      return;
    }
    setActiveStep((current) => Math.max(1, Math.min(current, lastInterpretStep)));
    const id = window.setInterval(() => {
      setActiveStep((current) => (current < lastInterpretStep ? current + 1 : current));
    }, STEP_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [phase, steps.length, lastInterpretStep]);

  const headline = copy.headlines[phase];
  const done = phase === "ready";
  const progress = done
    ? 100
    : Math.min(96, Math.round(((activeStep + 0.5) / steps.length) * 100));

  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-primary/20 bg-primary/[0.04] px-7 py-9 shadow-[var(--shadow-raised)]">
      <div className="flex flex-col items-center text-center">
        <div className="relative grid size-16 place-items-center">
          {done ? null : (
            <span
              className="absolute inset-0 animate-spin rounded-full border-2 border-primary/15 border-t-primary/70 [animation-duration:1.4s] motion-reduce:hidden"
              aria-hidden
            />
          )}
          <span
            className={cn(
              "grid size-[3.25rem] place-items-center rounded-2xl ring-1 transition-colors duration-300",
              done
                ? "bg-success/15 text-success ring-success/35"
                : "bg-primary/10 text-primary ring-primary/20"
            )}
          >
            {done ? (
              <Check className="size-6 animate-[import-ready-pop_0.3s_ease-out]" aria-hidden />
            ) : (
              <Sparkles className="size-6 animate-pulse motion-reduce:animate-none" aria-hidden />
            )}
          </span>
        </div>

        <div className="mt-5 min-h-7" role="status" aria-live="polite">
          <p
            key={headline}
            className="type-title font-semibold text-foreground animate-[import-phase-in_0.32s_ease-out] motion-reduce:animate-none"
          >
            {headline}
          </p>
        </div>

        <p className="mt-1 flex max-w-full items-center gap-1.5 type-meta text-muted-foreground">
          <FileSpreadsheet className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{fileName}</span>
        </p>

        <div
          className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span
            className="block h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
            style={{ width: `${progress}%` }}
            aria-hidden
          />
        </div>
      </div>

      <ul className="mt-6 space-y-2.5">
        {steps.map((step, index) => {
          const stepDone = index < activeStep;
          const stepActive = index === activeStep && !done;
          return (
            <li key={step} className="flex items-center gap-2.5">
              <span className="grid size-5 shrink-0 place-items-center">
                {stepDone ? (
                  <Check className="size-4 text-primary" aria-hidden />
                ) : stepActive ? (
                  <Loader2
                    className="size-4 animate-spin text-primary motion-reduce:animate-none"
                    aria-hidden
                  />
                ) : (
                  <span className="size-2 rounded-full bg-border" aria-hidden />
                )}
              </span>
              <span
                className={cn(
                  "type-meta transition-colors",
                  stepActive
                    ? "font-medium text-foreground"
                    : stepDone
                      ? "text-muted-foreground"
                      : "text-muted-foreground/50"
                )}
              >
                {step}
              </span>
            </li>
          );
        })}
      </ul>

      <style>{`
        @keyframes import-phase-in{0%{opacity:0;transform:translateY(4px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes import-ready-pop{0%{opacity:0;transform:scale(.6)}60%{transform:scale(1.12)}100%{opacity:1;transform:scale(1)}}
      `}</style>
    </div>
  );
}
