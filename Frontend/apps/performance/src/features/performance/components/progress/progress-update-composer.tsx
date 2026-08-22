"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { EvidenceInput, ObjectiveProgressDto, SubmitProgressRequest } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import { Input } from "@repo/ds/components/ui/input";
import { Label } from "@repo/ds/components/ui/label";
import { Textarea } from "@repo/ds/components/ui/textarea";
import { AsyncButton } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { EvidenceUploader } from "./evidence-uploader";
import { markerFraction, num, numericProgress, pct } from "./progress-lib";

type UploadFn = (file: File) => Promise<{ storageKey: string; fileName: string; contentType: string; sizeBytes: number }>;

/**
 * The Progress Update Composer — measurement-aware. Manual percentage takes a direct 0..100 value;
 * numeric target takes a current actual and previews the resulting progress against the baseline and
 * target; weighted milestones toggle completion directly. Context is required in-flow when a value
 * decreases, a milestone is reopened, or the entry corrects a mistake, and evidence attaches to the
 * same update.
 */
export function ProgressUpdateComposer({
  progress,
  submitting,
  onSubmit,
  upload,
}: {
  progress: ObjectiveProgressDto;
  submitting: boolean;
  onSubmit: (request: SubmitProgressRequest) => Promise<void>;
  upload: UploadFn;
}) {
  if (progress.method === "WeightedMilestones") {
    return <MilestoneUpdater progress={progress} submitting={submitting} onSubmit={onSubmit} />;
  }
  return <ValueUpdater progress={progress} submitting={submitting} onSubmit={onSubmit} upload={upload} />;
}

function ValueUpdater({
  progress,
  submitting,
  onSubmit,
  upload,
}: {
  progress: ObjectiveProgressDto;
  submitting: boolean;
  onSubmit: (request: SubmitProgressRequest) => Promise<void>;
  upload: UploadFn;
}) {
  const isNumeric = progress.method === "NumericTarget";
  const [value, setValue] = useState("");
  const [context, setContext] = useState("");
  const [correction, setCorrection] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceInput[]>([]);

  const entered = value === "" ? null : Number(value);

  const derived = useMemo(() => {
    if (entered == null) return null;
    if (isNumeric && progress.baseline != null && progress.target != null) {
      return numericProgress(progress.baseline, progress.target, entered);
    }
    return Math.max(0, entered);
  }, [entered, isNumeric, progress.baseline, progress.target]);

  const decreased = !isNumeric && entered != null && progress.currentPercentage != null && entered < progress.currentPercentage;
  const contextRequired = decreased || correction;
  const valid = entered != null && (!contextRequired || context.trim() !== "");

  async function save() {
    const request: SubmitProgressRequest = {
      percentage: isNumeric ? null : entered,
      numericActual: isNumeric ? entered : null,
      milestoneId: null,
      milestoneCompleted: null,
      contextNote: context.trim() || null,
      isCorrection: correction,
      evidence: evidence.length > 0 ? evidence : null,
    };
    try {
      await onSubmit(request);
      setValue("");
      setContext("");
      setCorrection(false);
      setEvidence([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record progress.");
    }
  }

  const frac =
    isNumeric && progress.baseline != null && progress.target != null && entered != null
      ? markerFraction(progress.baseline, progress.target, entered)
      : derived != null
        ? Math.min(1, derived / 100)
        : 0;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="pv-value">{isNumeric ? `Current value${progress.unit ? ` (${progress.unit})` : ""}` : "Completion %"}</Label>
        <Input
          id="pv-value"
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-40"
          placeholder={isNumeric && progress.currentActual != null ? num(progress.currentActual) : isNumeric ? "" : "0–100"}
          autoFocus
        />
      </div>

      {/* Derived-progress preview. */}
      {entered != null ? (
        <div className="rounded-xl border bg-muted/20 p-4">
          {isNumeric && progress.baseline != null && progress.target != null ? (
            <div className="mb-3">
              <div className="relative h-1.5 rounded-full bg-muted">
                <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${frac * 100}%` }} />
                <span
                  className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow"
                  style={{ left: `${frac * 100}%` }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-xs text-muted-foreground tabular-nums">
                <span>{num(progress.baseline)}{progress.unit ? ` ${progress.unit}` : ""}</span>
                <span>{num(progress.target)}{progress.unit ? ` ${progress.unit}` : ""}</span>
              </div>
            </div>
          ) : null}
          <div className="flex items-baseline gap-2">
            <span className={cn("text-2xl font-semibold tabular-nums", (derived ?? 0) >= 100 ? "text-success" : "text-foreground")}>
              {pct(derived)}%
            </span>
            {progress.hasProgress ? (
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <ArrowRight className="size-3.5" aria-hidden /> from {pct(progress.derivedProgress)}%
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">derived progress</span>
            )}
          </div>
        </div>
      ) : null}

      {!isNumeric ? (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={correction} onChange={(e) => setCorrection(e.target.checked)} className="size-4 rounded border-input" />
          This corrects a previous entry
        </label>
      ) : null}

      {contextRequired || context !== "" ? (
        <div className="space-y-1.5">
          <Label htmlFor="pv-context">Context{contextRequired ? "" : " (optional)"}</Label>
          <Textarea
            id="pv-context"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={2}
            placeholder={decreased ? "Why did this decrease?" : "What changed?"}
          />
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label>Evidence <span className="text-muted-foreground">(optional)</span></Label>
        <EvidenceUploader items={evidence} onChange={setEvidence} upload={upload} />
      </div>

      <div className="flex justify-end">
        <AsyncButton pending={submitting} disabled={!valid} onClick={save}>
          Record progress
        </AsyncButton>
      </div>
    </div>
  );
}

function MilestoneUpdater({
  progress,
  submitting,
  onSubmit,
}: {
  progress: ObjectiveProgressDto;
  submitting: boolean;
  onSubmit: (request: SubmitProgressRequest) => Promise<void>;
}) {
  const [reopening, setReopening] = useState<string | null>(null);
  const [context, setContext] = useState("");

  async function toggle(milestoneId: string, completed: boolean, note?: string) {
    try {
      await onSubmit({
        percentage: null,
        numericActual: null,
        milestoneId,
        milestoneCompleted: completed,
        contextNote: note ?? null,
        isCorrection: false,
        evidence: null,
      });
      setReopening(null);
      setContext("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the milestone.");
    }
  }

  const completedWeight = progress.milestones.filter((m) => m.isCompleted).reduce((sum, m) => sum + m.weight, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className={cn("text-2xl font-semibold tabular-nums", completedWeight >= 100 ? "text-success" : "text-foreground")}>
          {pct(completedWeight)}%
        </span>
        <span className="text-sm text-muted-foreground">of milestone weight complete</span>
      </div>

      <ul className="divide-y rounded-xl border">
        {progress.milestones.map((milestone) => (
          <li key={milestone.id} className="px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => (milestone.isCompleted ? setReopening(milestone.id) : void toggle(milestone.id, true))}
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                  milestone.isCompleted ? "border-success bg-success text-success-foreground" : "border-input hover:border-primary"
                )}
                aria-label={milestone.isCompleted ? "Reopen milestone" : "Complete milestone"}
              >
                {milestone.isCompleted ? <Check className="size-3.5" aria-hidden /> : null}
              </button>
              <span className={cn("flex-1 text-sm", milestone.isCompleted && "text-muted-foreground line-through")}>{milestone.title}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{pct(milestone.weight)}%</span>
            </div>

            {reopening === milestone.id ? (
              <div className="mt-2 space-y-2 pl-8">
                <Textarea value={context} onChange={(e) => setContext(e.target.value)} rows={2} placeholder="Why reopen this milestone?" autoFocus />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setReopening(null)}>Cancel</Button>
                  <AsyncButton pending={submitting} disabled={context.trim() === ""} onClick={() => toggle(milestone.id, false, context.trim())}>
                    <RotateCcw className="size-3.5" data-icon="inline-start" /> Reopen
                  </AsyncButton>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
