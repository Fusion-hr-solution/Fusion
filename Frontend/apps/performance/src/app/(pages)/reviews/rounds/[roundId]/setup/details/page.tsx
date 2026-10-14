"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@repo/ds/components/ui/input";
import { Label } from "@repo/ds/components/ui/label";
import { Switch } from "@repo/ds/components/ui/switch";
import { AsyncButton, PageSkeleton } from "@repo/ds/shell";
import { useReviewRound, useReviewRoundMutations } from "@/features/performance/api/use-reviews";
import { useCompetencies } from "@/features/performance/api/use-performance";
import { ContentUnavailable } from "@/features/performance/components/content-unavailable";
import { roundSetupHref, withCycle } from "@/lib/performance-routes";

export default function ReviewRoundDetailsPage() {
  const params = useParams<{ roundId: string }>();
  const router = useRouter();
  const roundId = params.roundId;
  const query = useReviewRound(roundId);
  const round = query.data;
  const mutations = useReviewRoundMutations(round?.cycleId ?? "", roundId);
  const competencies = useCompetencies();
  const [name, setName] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [selfAssessmentEnabled, setSelfAssessmentEnabled] = useState(true);
  const [objectiveRatingsEnabled, setObjectiveRatingsEnabled] = useState(true);
  const [calibrationEnabled, setCalibrationEnabled] = useState(false);
  const [selfAssessmentDueDate, setSelfAssessmentDueDate] = useState("");
  const [managerAssessmentDueDate, setManagerAssessmentDueDate] = useState("");
  const [competencyIds, setCompetencyIds] = useState<string[]>([]);
  const [initializedVersion, setInitializedVersion] = useState<number | null>(null);

  useEffect(() => {
    if (!round || initializedVersion === round.version) return;
    setName(round.name);
    setPeriodStart(round.periodStart);
    setPeriodEnd(round.periodEnd);
    setSelfAssessmentEnabled(round.selfAssessmentEnabled);
    setObjectiveRatingsEnabled(round.objectiveRatingsEnabled);
    setCalibrationEnabled(round.calibrationEnabled);
    setSelfAssessmentDueDate(round.selfAssessmentDueDate ?? "");
    setManagerAssessmentDueDate(round.managerAssessmentDueDate ?? "");
    setCompetencyIds(round.competencyIds);
    setInitializedVersion(round.version);
  }, [round, initializedVersion]);

  if (query.isLoading) return <PageSkeleton rows={6} label="Loading round details" />;
  if (query.error) return <ContentUnavailable error={query.error} onRetry={query.refetch} subject="Round details" />;
  if (!round) return <PageSkeleton rows={6} label="Loading round details" />;
  const currentRound = round;

  async function saveAndContinue() {
    try {
      await mutations.update.mutateAsync({
        name: name.trim(), periodStart, periodEnd,
        selfAssessmentEnabled, objectiveRatingsEnabled, calibrationEnabled,
        selfAssessmentDueDate: selfAssessmentDueDate || null,
        managerAssessmentDueDate: managerAssessmentDueDate || null,
        competencyIds,
        expectedVersion: currentRound.version,
      });
      toast.success("Round details saved.");
      router.push(withCycle(roundSetupHref(currentRound.id, "population"), currentRound.cycleId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save round details.");
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="max-w-2xl">
        <h2 className="type-section-title text-foreground">Review period and approach</h2>
        <p className="mt-1 text-sm text-muted-foreground">Choose what participants will complete. Due dates guide the work; they do not lock submissions.</p>
      </div>
      <div className="mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="round-name">Round name</Label><Input id="round-name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="period-start">Period starts</Label><Input id="period-start" type="date" value={periodStart} max={periodEnd} onChange={(event) => setPeriodStart(event.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="period-end">Period ends</Label><Input id="period-end" type="date" value={periodEnd} min={periodStart} onChange={(event) => setPeriodEnd(event.target.value)} /></div>
      </div>

      <div className="mt-8 border-y border-border divide-y divide-border">
        <SettingRow title="Self-assessment" description="Let each person reflect before their reviewer assesses them."><Switch checked={selfAssessmentEnabled} onCheckedChange={setSelfAssessmentEnabled} aria-label="Enable self-assessment" /></SettingRow>
        <SettingRow title="Objective ratings" description="Include a formal rating alongside each objective assessment."><Switch checked={objectiveRatingsEnabled} onCheckedChange={setObjectiveRatingsEnabled} aria-label="Enable objective ratings" /></SettingRow>
        <SettingRow title="Calibration" description="Add a calibration stage before administrative finalization."><Switch checked={calibrationEnabled} onCheckedChange={setCalibrationEnabled} aria-label="Enable calibration" /></SettingRow>
      </div>

      <div className="mt-8">
        <h3 className="type-section-title text-foreground">Advisory due dates</h3>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          {selfAssessmentEnabled ? <DueDate id="self-due" label="Self-assessment due" value={selfAssessmentDueDate} min={periodStart} max={periodEnd} onChange={setSelfAssessmentDueDate} /> : null}
          <DueDate id="manager-due" label="Reviewer assessment due" value={managerAssessmentDueDate} min={periodStart} max={periodEnd} onChange={setManagerAssessmentDueDate} />
        </div>
      </div>
      <fieldset className="mt-8 border-y border-border py-5">
        <legend className="type-section-title px-1">Competencies</legend>
        <p className="mb-3 text-sm text-muted-foreground">Choose the assessment language for this round. The selection is frozen when you launch.</p>
        {competencies.isLoading ? <p className="py-3 text-sm text-muted-foreground">Loading active competencies…</p> : competencies.error ? <ContentUnavailable error={competencies.error} onRetry={competencies.refetch} subject="Competencies" /> : competencies.data?.filter((item) => item.state === "Active").length ? (
          <ul className="divide-y divide-border">
            {competencies.data.filter((item) => item.state === "Active").map((item) => <li key={item.id} className="py-3">
              <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" className="mt-1 size-4 accent-primary" checked={competencyIds.includes(item.id)} onChange={(event) => setCompetencyIds((ids) => event.target.checked ? [...ids, item.id] : ids.filter((id) => id !== item.id))} /><span><span className="type-label">{item.name}</span><span className="mt-1 block text-sm text-muted-foreground">{item.description}</span></span></label>
            </li>)}
          </ul>
        ) : <p className="py-3 text-sm text-muted-foreground">No active competencies are available. You can continue without them.</p>}
      </fieldset>
      <div className="mt-8 flex justify-end border-t border-border pt-5">
        <AsyncButton pending={mutations.update.isLoading} disabled={!name.trim() || !periodStart || !periodEnd || periodEnd < periodStart} onClick={saveAndContinue}>Save and continue</AsyncButton>
      </div>
    </div>
  );
}

function SettingRow({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="flex min-h-20 items-center justify-between gap-5 py-4"><div><h3 className="type-label text-foreground">{title}</h3><p className="mt-1 max-w-xl text-sm text-muted-foreground">{description}</p></div>{children}</div>;
}

function DueDate({ id, label, value, min, max, onChange }: { id: string; label: string; value: string; min: string; max: string; onChange: (value: string) => void }) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label} <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id={id} type="date" value={value} min={min} max={max} onChange={(event) => onChange(event.target.value)} /></div>;
}
