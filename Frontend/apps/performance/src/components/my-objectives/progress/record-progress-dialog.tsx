"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import type {
  EmployeeObjectiveDto,
  ObjectiveProgressAttachmentDto,
  ObjectiveProgressStateDto,
  RecordObjectiveProgressRequest,
} from "@repo/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ProgressMeter } from "./progress-visuals";
import { progressTerms } from "./progress-terms";
import { useEvidence } from "./use-evidence";

export type RecordProgressTarget = {
  objective: EmployeeObjectiveDto;
  state: ObjectiveProgressStateDto;
};

export function RecordProgressDialog({
  target,
  isSaving,
  errors,
  onSubmit,
  onClose,
}: {
  target: RecordProgressTarget | null;
  isSaving: boolean;
  errors: string[];
  onSubmit: (request: RecordObjectiveProgressRequest) => void;
  onClose: () => void;
}) {
  const { upload } = useEvidence();
  const previous = target?.state.currentPercent ?? 0;
  const isQuantitative =
    (target?.objective.measurementMethod ?? "").toLowerCase() === "quantitative";

  const [percent, setPercent] = useState(previous);
  const [comment, setComment] = useState("");
  const [actual, setActual] = useState("");
  const [regressionConfirmed, setRegressionConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState<ObjectiveProgressAttachmentDto[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Reset local state each time a new objective's dialog opens.
  useEffect(() => {
    if (target) {
      setPercent(target.state.currentPercent);
      setComment("");
      setActual("");
      setRegressionConfirmed(false);
      setReason("");
      setEvidence([]);
    }
  }, [target]);

  const isRegression = target !== null && percent < previous;
  const canSubmit = useMemo(() => {
    if (!target || isSaving || uploading) return false;
    if (isRegression && (!regressionConfirmed || reason.trim().length === 0)) return false;
    return true;
  }, [target, isSaving, uploading, isRegression, regressionConfirmed, reason]);

  if (!target) return null;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const uploaded = await upload(file);
        setEvidence((current) => [...current, uploaded]);
      }
    } catch {
      toast.error("That file couldn't be attached. Try again.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const submit = () => {
    onSubmit({
      progressPercent: percent,
      actualValue: isQuantitative && actual.trim() ? actual.trim() : null,
      comment: comment.trim() ? comment.trim() : null,
      regressionConfirmed: isRegression ? regressionConfirmed : false,
      regressionReason: isRegression && reason.trim() ? reason.trim() : null,
      attachmentIds: evidence.length > 0 ? evidence.map((file) => file.id) : null,
    });
  };

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{progressTerms.dialogTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-foreground">{target.objective.title}</p>
            {isQuantitative && target.objective.targetValue ? (
              <p className="text-xs text-muted-foreground">
                {progressTerms.target}: {target.objective.measurementIndicator ?? ""}{" "}
                {target.objective.targetValue}
                {target.objective.targetUnit ? ` ${target.objective.targetUnit}` : ""}
              </p>
            ) : null}
          </div>

          {/* Value control: previous is always visible, then slider + numeric. */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="progress-percent">{progressTerms.progressLabel}</Label>
              <span className="text-xs text-muted-foreground">
                {progressTerms.currentValue}: <span className="tabular-nums">{previous}%</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Slider
                value={[percent]}
                min={0}
                max={100}
                step={5}
                onValueChange={(values) => setPercent(values[0] ?? 0)}
                className="flex-1"
              />
              <Input
                id="progress-percent"
                type="number"
                min={0}
                max={100}
                value={percent}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setPercent(Number.isNaN(next) ? 0 : Math.max(0, Math.min(100, next)));
                }}
                className="w-20 tabular-nums"
              />
            </div>
            <ProgressMeter
              percent={percent}
              tone={percent === 100 ? "success" : isRegression ? "warning" : "primary"}
            />
          </div>

          {isQuantitative ? (
            <div className="space-y-1.5">
              <Label htmlFor="progress-actual">{progressTerms.actualLabel}</Label>
              <Input
                id="progress-actual"
                value={actual}
                onChange={(event) => setActual(event.target.value)}
                placeholder={progressTerms.actualPlaceholder}
                maxLength={120}
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="progress-comment">{progressTerms.commentLabel}</Label>
            <Textarea
              id="progress-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder={progressTerms.commentPlaceholder}
              maxLength={500}
              rows={3}
            />
          </div>

          {/* Evidence */}
          <div className="space-y-1.5">
            <Label>{progressTerms.evidenceLabel}</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {evidence.map((file) => (
                <span
                  key={file.id}
                  className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs"
                >
                  <Paperclip className="size-3.5" />
                  {file.fileName}
                  <button
                    type="button"
                    onClick={() => setEvidence((current) => current.filter((item) => item.id !== file.id))}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${file.fileName}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
              >
                {uploading ? <Spinner className="size-3.5" /> : <Paperclip className="size-3.5" />}
                {progressTerms.evidenceAdd}
              </Button>
              <input
                ref={fileInput}
                type="file"
                className="hidden"
                multiple
                onChange={(event) => void handleFiles(event.target.files)}
              />
            </div>
          </div>

          {/* Regression confirmation — fail closed and quietly, revealed only when moving back. */}
          {isRegression ? (
            <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/8 p-3">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                {progressTerms.regressionTitle}
              </p>
              <p className="text-sm text-amber-900/90 dark:text-amber-200/90">
                {progressTerms.regressionBody(previous, percent)}
              </p>
              <label className="flex items-center gap-2 text-sm text-amber-900 dark:text-amber-200">
                <input
                  type="checkbox"
                  checked={regressionConfirmed}
                  onChange={(event) => setRegressionConfirmed(event.target.checked)}
                  className="size-4 accent-amber-600"
                />
                {progressTerms.regressionConfirm}
              </label>
              <div className="space-y-1.5">
                <Label htmlFor="regression-reason" className="text-amber-900 dark:text-amber-200">
                  {progressTerms.regressionReasonLabel}
                </Label>
                <Textarea
                  id="regression-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={progressTerms.regressionReasonPlaceholder}
                  maxLength={300}
                  rows={2}
                />
              </div>
            </div>
          ) : null}

          {errors.length > 0 ? (
            <Alert variant="destructive">
              <AlertDescription>
                <ul className="list-inside list-disc space-y-0.5">
                  {errors.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            {progressTerms.cancel}
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit}>
            {isSaving ? <Spinner className="size-4" /> : null}
            {isSaving ? progressTerms.saving : progressTerms.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
