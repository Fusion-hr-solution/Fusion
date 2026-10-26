"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Plus, Trash2, X } from "@/lib/icons";
import type { DevelopmentGoalDto, DevelopmentGoalInput, DevelopmentGoalStatus, DevelopmentPlanDto } from "@repo/api";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ds/components/ui/alert-dialog";
import { Button } from "@repo/ds/components/ui/button";
import { DatePicker } from "@repo/ds/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@repo/ds/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ds/components/ui/dropdown-menu";
import { Input } from "@repo/ds/components/ui/input";
import { Label } from "@repo/ds/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@repo/ds/components/ui/native-select";
import { AsyncButton, PageError } from "@repo/ds/shell";
import { Skeleton } from "@repo/ds/components/ui/skeleton";
import { cn } from "@repo/ds/lib/utils";
import { DEVELOPMENT_STATUS_LABEL } from "@repo/performance-ui";
import { reportPerformanceFailure } from "@/features/performance/api/performance-failure";
import { useDevelopmentMutations, useDevelopmentPlan } from "../../api/use-performance";
import { formatDate } from "../../lib";
import { PlanSection } from "./plan-layout";

const STATUSES: DevelopmentGoalStatus[] = ["NotStarted", "InProgress", "Done"];
const MAX_ACTIONS = 5;

/**
 * The plan's second section (D-34, S-08): up to five growth goals the employee and their reviewer keep
 * together, with no approval. Each goal reads like an objective card — title, competency, status, aimed-for
 * date, actions — and changes save at once. Open goals from the previous cycle are offered once here.
 */
export function DevelopmentSection({ cycleId, employeeId }: { cycleId: string; employeeId: string }) {
  const query = useDevelopmentPlan(cycleId, employeeId);
  const plan = query.data;
  const [composer, setComposer] = useState<{ goal?: DevelopmentGoalDto } | null>(null);

  return (
    <div id="development" className="scroll-mt-6">
      <PlanSection
        label="Development"
        count={plan && plan.goals.length > 0 ? plan.goals.length : undefined}
        action={
          // The empty state carries the first Add itself; with an offer to bring goals over, Add sits here instead.
          plan?.canEdit && plan.room > 0 && (plan.goals.length > 0 || plan.carryOver) ? (
            <Button size="sm" variant="outline" onClick={() => setComposer({})}>
              <Plus className="size-4" data-icon="inline-start" /> Add goal
            </Button>
          ) : null
        }
      >
        {query.isLoading ? (
          <Skeleton className="h-28 w-full rounded-surface" aria-label="Loading development" />
        ) : query.error || !plan ? (
          <PageError title="Development unavailable" description={query.error?.message} onRetry={query.refetch} />
        ) : (
          <div className="space-y-3">
            {plan.carryOver ? <CarryOverOffer plan={plan} cycleId={cycleId} employeeId={employeeId} /> : null}
            {plan.goals.length === 0 && plan.carryOver ? null : plan.goals.length === 0 ? (
              <div className="flex flex-col items-center rounded-surface border border-dashed border-border px-6 py-8 text-center">
                <p className="text-sm font-medium text-foreground">No development goals yet</p>
                {plan.canEdit ? (
                  <Button size="sm" className="mt-4" onClick={() => setComposer({})}>
                    <Plus className="size-4" data-icon="inline-start" /> Add a goal
                  </Button>
                ) : null}
              </div>
            ) : (
              plan.goals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} plan={plan} cycleId={cycleId} employeeId={employeeId} onEdit={() => setComposer({ goal })} />
              ))
            )}
          </div>
        )}
      </PlanSection>
      {composer && plan ? (
        <GoalComposer plan={plan} cycleId={cycleId} employeeId={employeeId} goal={composer.goal} onClose={() => setComposer(null)} />
      ) : null}
    </div>
  );
}

function toInput(goal: DevelopmentGoalDto, version: number, overrides: Partial<DevelopmentGoalInput> = {}): DevelopmentGoalInput {
  return {
    expectedVersion: version,
    title: goal.title,
    competencyId: goal.competencyId,
    actions: goal.actions,
    targetDate: goal.targetDate,
    status: goal.status,
    ...overrides,
  };
}

function GoalCard({ goal, plan, cycleId, employeeId, onEdit }: {
  goal: DevelopmentGoalDto;
  plan: DevelopmentPlanDto;
  cycleId: string;
  employeeId: string;
  onEdit: () => void;
}) {
  const mutations = useDevelopmentMutations(cycleId, employeeId);
  const [removing, setRemoving] = useState(false);
  const editable = plan.canEdit && !goal.carriedToCycleName;

  const setStatus = async (status: DevelopmentGoalStatus) => {
    try {
      await mutations.update.mutateAsync({ goalId: goal.id, input: toInput(goal, plan.version, { status }) });
    } catch (error) {
      reportPerformanceFailure(error, "Could not change the goal's status.");
    }
  };

  return (
    <div className={cn("rounded-surface border border-border bg-card p-5", goal.carriedToCycleName && "opacity-75")}>
      <div className="flex items-start gap-4">
        <StatusMark status={goal.status} />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold leading-snug tracking-tight text-foreground">{goal.title}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {goal.competencyName ? (
              <span className="rounded-full bg-primary-tint px-2 py-0.5 font-medium text-primary-ink ring-1 ring-inset ring-primary-ring">
                {goal.competencyName}
              </span>
            ) : null}
            {goal.targetDate && goal.status !== "Done" ? <span>By {formatDate(goal.targetDate)}</span> : null}
            {goal.carriedFromEarlierCycle ? <span>From last cycle</span> : null}
            {goal.carriedToCycleName ? <span className="font-medium text-foreground">Carried to {goal.carriedToCycleName}</span> : null}
          </p>
        </div>
        {editable ? (
          <div className="flex shrink-0 items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={mutations.update.isLoading}>
                  {DEVELOPMENT_STATUS_LABEL[goal.status]}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup value={goal.status} onValueChange={(value) => void setStatus(value as DevelopmentGoalStatus)}>
                  {STATUSES.map((status) => (
                    <DropdownMenuRadioItem key={status} value={status}>{DEVELOPMENT_STATUS_LABEL[status]}</DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`More for ${goal.title}`}>
                  <MoreHorizontal className="size-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onEdit}>
                  <Pencil className="size-4" aria-hidden /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setRemoving(true)}>
                  <Trash2 className="size-4" aria-hidden /> Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <span className="shrink-0 text-xs font-medium text-muted-foreground">{DEVELOPMENT_STATUS_LABEL[goal.status]}</span>
        )}
      </div>

      {goal.actions.length > 0 ? (
        <ul className="mt-4 space-y-1.5 border-t border-border/60 pt-4 ps-10">
          {goal.actions.map((action, index) => (
            <li key={index} className="flex gap-2.5 text-sm text-foreground/85">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden />
              {action}
            </li>
          ))}
        </ul>
      ) : null}

      <AlertDialog open={removing} onOpenChange={(open) => { if (!mutations.remove.isLoading) setRemoving(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this goal?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{goal.title}</span> leaves the development plan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutations.remove.isLoading}>Keep it</AlertDialogCancel>
            <AsyncButton
              variant="destructive"
              pending={mutations.remove.isLoading}
              onClick={async () => {
                try {
                  await mutations.remove.mutateAsync({ goalId: goal.id, expectedVersion: plan.version });
                  setRemoving(false);
                } catch (error) {
                  reportPerformanceFailure(error, "Could not remove the goal.");
                }
              }}
            >
              Remove goal
            </AsyncButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** The goal's status by shape: an empty ring, a half-filled ring, a filled check. */
function StatusMark({ status }: { status: DevelopmentGoalStatus }) {
  return (
    <span
      aria-hidden
      className={cn(
        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2",
        status === "Done" && "border-success bg-success text-background",
        status === "InProgress" && "border-primary bg-[linear-gradient(90deg,var(--primary)_50%,transparent_50%)]",
        status === "NotStarted" && "border-muted-foreground/40"
      )}
    >
      {status === "Done" ? (
        <svg viewBox="0 0 12 12" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2.5 6.5l2.2 2.2 4.8-5" />
        </svg>
      ) : null}
    </span>
  );
}

/** Open goals from the previous cycle, offered once: choose which to bring over, or dismiss the offer. */
function CarryOverOffer({ plan, cycleId, employeeId }: { plan: DevelopmentPlanDto; cycleId: string; employeeId: string }) {
  const offer = plan.carryOver!;
  const mutations = useDevelopmentMutations(cycleId, employeeId);
  const [choosing, setChoosing] = useState(false);
  const [chosen, setChosen] = useState<string[]>(offer.goals.slice(0, plan.room).map((g) => g.id));
  const count = offer.goals.length;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-surface bg-card px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="type-label text-foreground">{count} open goal{count === 1 ? "" : "s"} from {offer.fromCycleName}</p>
        <p className="truncate type-meta text-muted-foreground">{offer.goals.map((goal) => goal.title).join(", ")}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        disabled={mutations.dismiss.isLoading}
        onClick={async () => {
          try {
            await mutations.dismiss.mutateAsync(plan.version);
          } catch (error) {
            reportPerformanceFailure(error, "Could not dismiss the offer.");
          }
        }}
      >
        Dismiss
      </Button>
      <Button size="sm" onClick={() => setChoosing(true)}>Bring over</Button>

      <Dialog open={choosing} onOpenChange={(open) => { if (!mutations.carryOver.isLoading) setChoosing(open); }}>
        <DialogContent className="w-[min(32rem,calc(100vw-2rem))] max-w-none">
          <DialogHeader>
            <DialogTitle>Bring goals over from {offer.fromCycleName}</DialogTitle>
            <DialogDescription>Room for {plan.room} more</DialogDescription>
          </DialogHeader>
          <ul className="space-y-1.5">
            {offer.goals.map((goal) => {
              const on = chosen.includes(goal.id);
              const full = !on && chosen.length >= plan.room;
              return (
                <li key={goal.id}>
                  <label className={cn("flex items-center gap-3 rounded-control border px-3 py-2.5 text-sm", on ? "border-primary" : "border-border", full && "opacity-50")}>
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={on}
                      disabled={full}
                      onChange={() => setChosen((ids) => (on ? ids.filter((id) => id !== goal.id) : [...ids, goal.id]))}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-foreground">{goal.title}</span>
                      <span className="block text-xs text-muted-foreground">{DEVELOPMENT_STATUS_LABEL[goal.status]}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChoosing(false)} disabled={mutations.carryOver.isLoading}>Cancel</Button>
            <AsyncButton
              pending={mutations.carryOver.isLoading}
              disabled={chosen.length === 0}
              onClick={async () => {
                try {
                  await mutations.carryOver.mutateAsync({ goalIds: chosen, expectedVersion: plan.version });
                  toast.success(chosen.length === 1 ? "1 goal brought over." : `${chosen.length} goals brought over.`);
                  setChoosing(false);
                } catch (error) {
                  reportPerformanceFailure(error, "Could not bring the goals over.");
                }
              }}
            >
              Bring over {chosen.length}
            </AsyncButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Add or edit one goal: title, competency, actions, aimed-for date and status. */
function GoalComposer({ plan, cycleId, employeeId, goal, onClose }: {
  plan: DevelopmentPlanDto;
  cycleId: string;
  employeeId: string;
  goal?: DevelopmentGoalDto;
  onClose: () => void;
}) {
  const mutations = useDevelopmentMutations(cycleId, employeeId);
  const [title, setTitle] = useState(goal?.title ?? "");
  const [competencyId, setCompetencyId] = useState(goal?.competencyId ?? "");
  const [actions, setActions] = useState<string[]>(goal?.actions.length ? goal.actions : [""]);
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? "");
  const [status, setStatus] = useState<DevelopmentGoalStatus>(goal?.status ?? "NotStarted");
  const saving = mutations.add.isLoading || mutations.update.isLoading;

  const save = async () => {
    const input: DevelopmentGoalInput = {
      expectedVersion: plan.version,
      title: title.trim(),
      competencyId: competencyId || null,
      actions: actions.map((a) => a.trim()).filter(Boolean),
      targetDate: targetDate || null,
      status,
    };
    try {
      if (goal) await mutations.update.mutateAsync({ goalId: goal.id, input });
      else await mutations.add.mutateAsync(input);
      onClose();
    } catch (error) {
      reportPerformanceFailure(error, "Could not save the goal.");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="w-[min(36rem,calc(100vw-2rem))] max-w-none">
        <DialogHeader>
          <DialogTitle>{goal ? "Edit goal" : "Add a development goal"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="dg-title">Goal</Label>
            <Input id="dg-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="dg-competency">Competency <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <NativeSelect id="dg-competency" value={competencyId} onChange={(e) => setCompetencyId(e.target.value)} className="w-full">
                <NativeSelectOption value="">None</NativeSelectOption>
                {plan.competencyOptions.map((option) => (
                  <NativeSelectOption key={option.id} value={option.id}>{option.name}</NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dg-target">By <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <DatePicker id="dg-target" value={targetDate} onChange={setTargetDate} />
            </div>
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-foreground">Status</legend>
            <div role="radiogroup" aria-label="Status" className="grid grid-cols-3 gap-2">
              {STATUSES.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={status === value}
                  onClick={() => setStatus(value)}
                  className={cn(
                    "rounded-control border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    status === value ? "border-primary bg-primary-tint text-primary-ink" : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {DEVELOPMENT_STATUS_LABEL[value]}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">Actions <span className="font-normal text-muted-foreground">(optional)</span></legend>
            {actions.map((action, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  aria-label={`Action ${index + 1}`}
                  value={action}
                  maxLength={200}
                  onChange={(e) => setActions((all) => all.map((a, i) => (i === index ? e.target.value : a)))}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove action ${index + 1}`}
                  onClick={() => setActions((all) => (all.length === 1 ? [""] : all.filter((_, i) => i !== index)))}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            ))}
            {actions.length < MAX_ACTIONS ? (
              <Button variant="ghost" size="sm" className="-ms-2" onClick={() => setActions((all) => [...all, ""])}>
                <Plus className="size-4" data-icon="inline-start" /> Add an action
              </Button>
            ) : null}
          </fieldset>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <AsyncButton pending={saving} disabled={title.trim() === ""} onClick={save}>
            {goal ? "Save goal" : "Add goal"}
          </AsyncButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
