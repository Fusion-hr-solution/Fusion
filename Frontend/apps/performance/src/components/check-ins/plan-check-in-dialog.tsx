"use client";

import { useEffect, useMemo, useState } from "react";
import type { DiscussionSignalDto, PlanCheckInRequest } from "@repo/api";
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
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { checkInTerms } from "./check-in-terms";

export interface LinkableObjective {
  id: string;
  title: string;
}

export function PlanCheckInDialog({
  open,
  employeeId,
  objectives,
  openSignals,
  isSaving,
  errors,
  onSubmit,
  onClose,
}: {
  open: boolean;
  employeeId: string;
  objectives: LinkableObjective[];
  openSignals: DiscussionSignalDto[];
  isSaving: boolean;
  errors: string[];
  onSubmit: (request: PlanCheckInRequest) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [agenda, setAgenda] = useState("");
  const [linkedObjectiveIds, setLinkedObjectiveIds] = useState<string[]>([]);
  const [signalIds, setSignalIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setDate("");
      setTime("");
      setReason("");
      setAgenda("");
      // Pre-select every open signal — the manager is planning the conversation the employee asked for.
      setSignalIds(openSignals.map((signal) => signal.id));
      setLinkedObjectiveIds(
        openSignals
          .map((signal) => signal.objectiveId)
          .filter((id) => objectives.some((objective) => objective.id === id)),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const canSubmit = useMemo(
    () => !isSaving && date.trim().length > 0 && reason.trim().length > 0,
    [isSaving, date, reason],
  );

  const toggle = (list: string[], id: string): string[] =>
    list.includes(id) ? list.filter((item) => item !== id) : [...list, id];

  const submit = () => {
    onSubmit({
      employeeId,
      plannedDate: new Date(`${date}T00:00:00Z`).toISOString(),
      plannedTime: time.trim() ? time.trim() : null,
      reason: reason.trim(),
      agenda: agenda.trim() ? agenda.trim() : null,
      linkedObjectiveIds: linkedObjectiveIds.length > 0 ? linkedObjectiveIds : null,
      discussionSignalIds: signalIds.length > 0 ? signalIds : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{checkInTerms.planTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="check-in-date">{checkInTerms.dateLabel}</Label>
              <Input
                id="check-in-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="check-in-time">{checkInTerms.timeLabel}</Label>
              <Input
                id="check-in-time"
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="w-32"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="check-in-reason">{checkInTerms.reasonLabel}</Label>
            <Input
              id="check-in-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={checkInTerms.reasonPlaceholder}
              maxLength={500}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="check-in-agenda">{checkInTerms.agendaLabel}</Label>
            <Textarea
              id="check-in-agenda"
              value={agenda}
              onChange={(event) => setAgenda(event.target.value)}
              placeholder={checkInTerms.agendaPlaceholder}
              maxLength={2000}
              rows={3}
            />
          </div>

          {openSignals.length > 0 ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">
                {checkInTerms.linkSignalsLabel}
              </legend>
              <div className="space-y-1.5">
                {openSignals.map((signal) => (
                  <label
                    key={signal.id}
                    className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={signalIds.includes(signal.id)}
                      onChange={() => setSignalIds((list) => toggle(list, signal.id))}
                      className="mt-0.5 size-4 accent-amber-600"
                    />
                    <span className="min-w-0">
                      <span className="font-medium text-foreground">
                        {signal.objectiveTitle}
                      </span>
                      {signal.note ? (
                        <span className="block text-xs text-muted-foreground">
                          {signal.note}
                        </span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          {objectives.length > 0 ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">
                {checkInTerms.linkObjectivesLabel}
              </legend>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2">
                {objectives.map((objective) => (
                  <label
                    key={objective.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      checked={linkedObjectiveIds.includes(objective.id)}
                      onChange={() =>
                        setLinkedObjectiveIds((list) => toggle(list, objective.id))
                      }
                      className="size-4 accent-primary"
                    />
                    <span className="truncate text-foreground">{objective.title}</span>
                  </label>
                ))}
              </div>
            </fieldset>
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
            {checkInTerms.keep}
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit}>
            {isSaving ? <Spinner className="size-4" /> : null}
            {isSaving ? checkInTerms.planning : checkInTerms.planCta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
