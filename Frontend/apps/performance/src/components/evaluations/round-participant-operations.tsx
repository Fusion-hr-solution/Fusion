"use client";

import { useMemo, useState } from "react";
import { UserMinus, UserRoundCog } from "lucide-react";
import {
  createPlatformApiClient,
  readPerformanceFailure,
  type EvaluationAssignmentRosterItemDto,
  type EvaluationRoundDetailDto,
} from "@repo/api";
import { performancePaths } from "@repo/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

import { roundOperationTerms } from "./round-operation-terms";

/**
 * HR's mid-round corrections: take someone out of a launched round, or move their manager
 * assessment to a different reviewer.
 *
 * Both endpoints have existed and been contract-typed since the evaluation work landed, with no way
 * to reach them — so HR could handle a leaver during planning but not during evaluation. These are
 * the surfaces that make them operable.
 */
export function RoundParticipantOperations({
  round,
  participant,
  canOperate,
  onChanged,
}: {
  round: EvaluationRoundDetailDto;
  participant: EvaluationAssignmentRosterItemDto;
  /** Mirrors the server's rule, so an unusable control is never rendered at all. */
  canOperate: boolean;
  onChanged: () => Promise<unknown>;
}) {
  const [excludeOpen, setExcludeOpen] = useState(false);
  const [reviewerOpen, setReviewerOpen] = useState(false);

  if (!canOperate) {
    return null;
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setReviewerOpen(true)}
        aria-label={roundOperationTerms.reassign.trigger(participant.participantName)}
      >
        <UserRoundCog />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setExcludeOpen(true)}
        aria-label={roundOperationTerms.exclude.trigger(participant.participantName)}
      >
        <UserMinus />
      </Button>

      <ExcludeParticipantDialog
        open={excludeOpen}
        onOpenChange={setExcludeOpen}
        round={round}
        participant={participant}
        onChanged={onChanged}
      />
      <ReassignReviewerDialog
        open={reviewerOpen}
        onOpenChange={setReviewerOpen}
        round={round}
        participant={participant}
        onChanged={onChanged}
      />
    </div>
  );
}

/**
 * Excluding removes outstanding work from the reviewer's queue, from completion, and from the
 * auto-closure condition — while preserving whatever was already recorded.
 */
function ExcludeParticipantDialog({
  open,
  onOpenChange,
  round,
  participant,
  onChanged,
}: OperationDialogProps) {
  const api = useMemo(() => createPlatformApiClient(), []);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setFailure(null);
    try {
      await api.put(
        performancePaths.evaluationRoundExclusion(
          round.round.id,
          participant.participantEmployeeId,
        ),
        { excluded: true, reason: reason.trim() },
        { headers: { "If-Match": `"${round.round.version}"` } },
      );
      toast.success(roundOperationTerms.exclude.success);
      onOpenChange(false);
      setReason("");
      await onChanged();
    } catch (error) {
      // Keep the reason the user typed; a failure must not cost them their input.
      setFailure(readPerformanceFailure(error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{roundOperationTerms.exclude.title}</DialogTitle>
          <DialogDescription>
            {roundOperationTerms.exclude.description(participant.participantName)}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="exclusion-reason">
              {roundOperationTerms.exclude.reasonLabel}
            </FieldLabel>
            <Textarea
              id="exclusion-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={roundOperationTerms.exclude.reasonPlaceholder}
            />
          </Field>
          {failure ? (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          ) : null}
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {roundOperationTerms.cancel}
          </Button>
          <Button disabled={!reason.trim() || saving} onClick={submit}>
            {saving
              ? roundOperationTerms.saving
              : roundOperationTerms.exclude.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Reassigning moves outstanding manager work to a different reviewer, preserving any draft they had
 * already saved. Never consults live Core HR reporting lines — the round's frozen baseline is the
 * only truth here.
 */
function ReassignReviewerDialog({
  open,
  onOpenChange,
  round,
  participant,
  onChanged,
}: OperationDialogProps) {
  const api = useMemo(() => createPlatformApiClient(), []);
  const [form, setForm] = useState({ reviewerEmployeeId: "", reviewerName: "", reason: "" });
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setFailure(null);
    try {
      await api.put(
        performancePaths.evaluationRoundReviewer(
          round.round.id,
          participant.participantEmployeeId,
        ),
        {
          reviewerEmployeeId: form.reviewerEmployeeId.trim(),
          reviewerName: form.reviewerName.trim(),
          reason: form.reason.trim(),
        },
        { headers: { "If-Match": `"${round.round.version}"` } },
      );
      toast.success(roundOperationTerms.reassign.success);
      onOpenChange(false);
      setForm({ reviewerEmployeeId: "", reviewerName: "", reason: "" });
      await onChanged();
    } catch (error) {
      setFailure(readPerformanceFailure(error).message);
    } finally {
      setSaving(false);
    }
  };

  const complete =
    form.reviewerEmployeeId.trim() && form.reviewerName.trim() && form.reason.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{roundOperationTerms.reassign.title}</DialogTitle>
          <DialogDescription>
            {roundOperationTerms.reassign.description(participant.participantName)}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="reviewer-id">
              {roundOperationTerms.reassign.reviewerIdLabel}
            </FieldLabel>
            <Input
              id="reviewer-id"
              value={form.reviewerEmployeeId}
              onChange={(event) =>
                setForm({ ...form, reviewerEmployeeId: event.target.value })
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="reviewer-name">
              {roundOperationTerms.reassign.reviewerNameLabel}
            </FieldLabel>
            <Input
              id="reviewer-name"
              value={form.reviewerName}
              onChange={(event) => setForm({ ...form, reviewerName: event.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="reviewer-reason">
              {roundOperationTerms.reassign.reasonLabel}
            </FieldLabel>
            <Textarea
              id="reviewer-reason"
              value={form.reason}
              onChange={(event) => setForm({ ...form, reason: event.target.value })}
              placeholder={roundOperationTerms.reassign.reasonPlaceholder}
            />
          </Field>
          {failure ? (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          ) : null}
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {roundOperationTerms.cancel}
          </Button>
          <Button disabled={!complete || saving} onClick={submit}>
            {saving
              ? roundOperationTerms.saving
              : roundOperationTerms.reassign.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type OperationDialogProps = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  round: EvaluationRoundDetailDto;
  participant: EvaluationAssignmentRosterItemDto;
  onChanged: () => Promise<unknown>;
};
