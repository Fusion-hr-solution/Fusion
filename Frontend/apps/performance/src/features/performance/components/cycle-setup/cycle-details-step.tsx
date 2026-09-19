"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, FileText, Flag, Gauge, Users } from "lucide-react";
import { toast } from "sonner";
import type { CycleDetailDto } from "@repo/api";
import { Input } from "@repo/ds/components/ui/input";
import { Textarea } from "@repo/ds/components/ui/textarea";
import { DatePicker } from "@repo/ds/components/ui/date-picker";
import { Label } from "@repo/ds/components/ui/label";
import { AsyncButton } from "@repo/ds/shell";
import { useCreateCycle, useSettings, useUpdateCycle } from "@/features/performance/api/use-performance";
import { SetupStepFooter } from "./setup-step-footer";
import { CycleTimeline } from "./cycle-timeline";
import { useSetupShell } from "./setup-shell-context";

const DESCRIPTION_MAX = 500;
const DAY = 86_400_000;

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** A new Cycle opens on a one-year horizon from today; the planning deadline is the backend's to
 *  derive from tenant policy, so it stays empty until the draft exists. */
function newCycleDefaults(): { startDate: string; endDate: string } {
  const start = new Date();
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);
  end.setDate(end.getDate() - 1);
  return { startDate: toISODate(start), endDate: toISODate(end) };
}

/** Start date + the tenant's planning-deadline offset, clamped to the cycle end. */
function defaultDeadline(start: string, end: string, offsetDays: number): string {
  if (!start) return "";
  const d = new Date(`${start}T00:00:00`);
  d.setDate(d.getDate() + offsetDays);
  const iso = toISODate(d);
  return end && iso > end ? end : iso;
}

function Required() {
  return <span className="ml-0.5 text-destructive" aria-hidden>*</span>;
}

/**
 * Step 1 — the Cycle's own definition and nothing else. Continue creates the draft (or updates it
 * on return) and advances to Population; "Save and exit" persists and leaves the flow.
 */
export function CycleDetailsStep({ detail }: { detail: CycleDetailDto | null }) {
  const router = useRouter();
  const shell = useSetupShell();
  const draft = detail?.cycle.state === "Draft" ? detail.cycle : null;
  const createCycle = useCreateCycle();
  const updateCycle = useUpdateCycle(draft?.id ?? "");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [planningDeadline, setPlanningDeadline] = useState("");
  const [deadlineTouched, setDeadlineTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const offsetDays = useSettings().data?.planningDeadlineOffsetDays ?? 30;

  // Seed from the draft (or fresh defaults) once it resolves; keyed on the draft id so a freshly
  // created draft rehydrates the concrete, server-derived planning deadline on return.
  useEffect(() => {
    const defaults = draft ? null : newCycleDefaults();
    setName(draft?.name ?? "");
    setDescription(draft?.description ?? "");
    setStartDate(draft?.startDate ?? defaults?.startDate ?? "");
    setEndDate(draft?.endDate ?? defaults?.endDate ?? "");
    setPlanningDeadline(draft?.planningDeadline ?? "");
    setDeadlineTouched(Boolean(draft?.planningDeadline));
  }, [draft?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // For a new cycle, keep the planning deadline defaulted to start + the tenant's offset until the
  // admin sets it themselves, so the field is never blank and reflects real tenant policy.
  useEffect(() => {
    if (draft || deadlineTouched) return;
    setPlanningDeadline(defaultDeadline(startDate, endDate, offsetDays));
  }, [draft, deadlineTouched, startDate, endDate, offsetDays]);

  const datesInvalid = Boolean(startDate && endDate && endDate <= startDate);
  const valid = name.trim().length > 0 && Boolean(startDate) && Boolean(endDate) && !datesInvalid;

  const persist = useCallback(async () => {
    if (draft) {
      await updateCycle.mutateAsync({
        name: name.trim(),
        startDate,
        endDate,
        planningDeadline,
        description: description.trim() || null,
      });
    } else {
      await createCycle.mutateAsync({
        name: name.trim(),
        startDate,
        endDate,
        planningDeadline: planningDeadline || null,
        description: description.trim() || null,
      });
    }
  }, [draft, updateCycle, createCycle, name, startDate, endDate, planningDeadline, description]);

  async function submit() {
    setSubmitting(true);
    try {
      await persist();
      router.push("/cycle/setup/population");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the Cycle.");
      setSubmitting(false);
    }
  }

  // "Save and exit" (shared header): persist when there's something valid to keep, then leave.
  const saveAndExit = useCallback(async () => {
    try {
      if (valid) {
        await persist();
        toast.success("Cycle setup saved.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the Cycle.");
      return;
    }
    router.push("/performance");
  }, [valid, persist, router]);

  useEffect(() => {
    shell.setExitHandler(saveAndExit);
    return () => shell.setExitHandler(null);
  }, [shell, saveAndExit]);

  const span = useMemo(() => {
    const s = startDate ? Date.parse(startDate) : NaN;
    const e = endDate ? Date.parse(endDate) : NaN;
    if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return null;
    const months = Math.round((e - s) / DAY / 30.44);
    return months >= 1 ? { value: months, unit: months === 1 ? "month" : "months" } : { value: Math.round((e - s) / DAY / 7), unit: "weeks" };
  }, [startDate, endDate]);

  const planningWindow = useMemo(() => {
    const s = startDate ? Date.parse(startDate) : NaN;
    const d = planningDeadline ? Date.parse(planningDeadline) : NaN;
    if (Number.isNaN(s) || Number.isNaN(d) || d < s) return null;
    return Math.round((d - s) / DAY);
  }, [startDate, planningDeadline]);

  return (
    <div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* main form card */}
        <section className="rounded-2xl border border-border bg-card p-6 lg:p-7">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="size-5" aria-hidden />
            </span>
            <h2 className="type-section-title text-foreground">Cycle details</h2>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cycle-name">
                Cycle name <Required />
              </Label>
              <Input
                id="cycle-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Performance 2026"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="cycle-description">
                  Description <span className="text-muted-foreground">(optional)</span>
                </Label>
                <span className="type-meta tabular-nums text-muted-foreground">
                  {description.length}/{DESCRIPTION_MAX}
                </span>
              </div>
              <Textarea
                id="cycle-description"
                value={description}
                maxLength={DESCRIPTION_MAX}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                placeholder="What this cycle is for…"
              />
            </div>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarDays className="size-5" aria-hidden />
            </span>
            <h3 className="type-subsection-title text-foreground">Timeline</h3>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="cycle-start">
                Start date <Required />
              </Label>
              <DatePicker id="cycle-start" value={startDate} onChange={setStartDate} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cycle-deadline">
                Planning deadline <Required />
              </Label>
              <DatePicker
                id="cycle-deadline"
                value={planningDeadline}
                min={startDate || undefined}
                max={endDate || undefined}
                onChange={(value) => {
                  setDeadlineTouched(true);
                  setPlanningDeadline(value);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cycle-end">
                End date <Required />
              </Label>
              <DatePicker id="cycle-end" value={endDate} min={startDate || undefined} onChange={setEndDate} />
            </div>
          </div>

          {datesInvalid ? (
            <p className="mt-3 text-sm text-destructive">The end date must be after the start date.</p>
          ) : null}

          <div className="mt-7">
            <CycleTimeline startDate={startDate} endDate={endDate} planningDeadline={planningDeadline} />
          </div>
        </section>

        {/* live summary aside */}
        <aside className="rounded-2xl border border-border bg-muted/30 p-6">
          <div className="flex items-center gap-2.5">
            <Gauge className="size-4 text-primary" aria-hidden />
            <h2 className="type-panel-title text-foreground">At a glance</h2>
          </div>

          <div className="mt-5 space-y-5">
            <div>
              <p className="type-metric text-foreground">
                {span ? span.value : "—"}
                {span ? <span className="ml-1.5 type-body-secondary text-muted-foreground">{span.unit}</span> : null}
              </p>
              <p className="type-meta mt-0.5 text-muted-foreground">Cycle length</p>
            </div>
            <div>
              <p className="type-subsection-title text-foreground">
                {planningWindow !== null ? (
                  <>
                    {planningWindow}
                    <span className="ml-1.5 type-body-secondary text-muted-foreground">
                      day{planningWindow === 1 ? "" : "s"} to plan
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Set automatically</span>
                )}
              </p>
              <p className="type-meta mt-0.5 text-muted-foreground">Planning window</p>
            </div>
          </div>

          <div className="mt-6 border-t border-border/70 pt-5">
            <p className="type-eyebrow text-muted-foreground">Up next</p>
            <ul className="mt-3 space-y-3">
              <UpNext icon={Users} step={2} label="Population" caption="Choose who takes part" />
              <UpNext icon={Flag} step={3} label="Review & launch" caption="Confirm and go live" />
            </ul>
          </div>
        </aside>
      </div>

      <SetupStepFooter cancelHref="/performance">
        <AsyncButton pending={submitting} disabled={!valid} onClick={submit}>
          Next
          <ArrowRight className="size-4" data-icon="inline-end" />
        </AsyncButton>
      </SetupStepFooter>
    </div>
  );
}

function UpNext({
  icon: Icon,
  step,
  label,
  caption,
}: {
  icon: typeof Users;
  step: number;
  label: string;
  caption: string;
}) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="type-label text-foreground">
          <span className="tabular-nums text-muted-foreground">{step}.</span> {label}
        </p>
        <p className="type-meta text-muted-foreground">{caption}</p>
      </div>
    </li>
  );
}
