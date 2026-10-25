"use client";

import { useCallback, type ReactNode } from "react";
import {
  ApiError,
  type CycleSettingsDto,
  type FusionSettingsSection,
  type MeasurementMethod,
  type OneOnOneCadence,
  type PlanAlignmentPolicy,
  type RatingScaleLevelDto,
} from "@repo/api";
import { useSettingsConflictSaver } from "@repo/api/query";
import { useStagedSettings, type StagedSettings } from "@repo/api/react";
import { cn, Input, NativeSelect, NativeSelectOption, RadioGroup, RadioGroupItem, Slider, Switch } from "@repo/ds";
import {
  PageError,
  SettingsBlock,
  SettingsPage,
  SettingsRow,
  SettingsRows,
  SettingsSaveBar,
  SettingsValue,
} from "@repo/ds/shell";
import { useRatingScale, useSettings } from "@/features/performance/api/use-performance";
import { useSaveCycleSettings, type CycleSettingsRequest } from "../api";
import { CYCLE_SETTINGS_SECTIONS } from "../performance-settings";

type Draft = CycleSettingsDto;
type Update = StagedSettings<Draft>["update"];

/** Joins a section's consequence sentences: two at most, then how many more. */
export function joinConsequences(sentences: string[]): string {
  if (sentences.length <= 2) return sentences.join(" ");
  const more = sentences.length - 2;
  return `${sentences.slice(0, 2).join(" ")} And ${more === 1 ? "1 more change" : `${more} more changes`}.`;
}

const days = (n: number) => (n === 1 ? "1 day" : `${n} days`);

/** What saving Reviews does. */
export function reviewsConsequence(saved: Draft, draft: Draft): string {
  const s: string[] = [];
  const include = (on: boolean, what: string) => s.push(on ? `New review rounds include ${what}.` : `New review rounds no longer include ${what}.`);
  if (saved.defaultSelfAssessmentEnabled !== draft.defaultSelfAssessmentEnabled) include(draft.defaultSelfAssessmentEnabled, "a self-assessment");
  if (saved.defaultObjectiveRatingsEnabled !== draft.defaultObjectiveRatingsEnabled) include(draft.defaultObjectiveRatingsEnabled, "a rating for each objective");
  if (saved.defaultCalibrationEnabled !== draft.defaultCalibrationEnabled)
    s.push(draft.defaultCalibrationEnabled ? "New review rounds go through calibration before results are released." : "New review rounds release results without calibration.");
  const dueChanged =
    saved.selfAssessmentDueDays !== draft.selfAssessmentDueDays ||
    saved.peerInputDueDays !== draft.peerInputDueDays ||
    saved.managerAssessmentDueDays !== draft.managerAssessmentDueDays;
  if (saved.selfAssessmentDueDays !== draft.selfAssessmentDueDays) s.push(`New review rounds give people ${days(draft.selfAssessmentDueDays)} for their self-assessment.`);
  if (saved.peerInputDueDays !== draft.peerInputDueDays) s.push(`New review rounds give peers ${days(draft.peerInputDueDays)}.`);
  if (saved.managerAssessmentDueDays !== draft.managerAssessmentDueDays) s.push(`New review rounds give managers ${days(draft.managerAssessmentDueDays)}.`);
  if (saved.acknowledgementReminderDays !== draft.acknowledgementReminderDays)
    s.push(`Unacknowledged results are reminded after ${days(draft.acknowledgementReminderDays)}.`);
  if (saved.nineBoxBands.lowTop !== draft.nineBoxBands.lowTop || saved.nineBoxBands.midTop !== draft.nineBoxBands.midTop)
    s.push("Calibration sessions opened from now on use the new bands.");
  const joined = joinConsequences(s);
  // New dates never move rounds already created; said once, while the bar has room for it.
  return dueChanged && s.length <= 2 ? `${joined} Rounds already created keep their dates.` : joined;
}

const MEASUREMENT: { value: MeasurementMethod; label: string; detail: string }[] = [
  { value: "NumericTarget", label: "Toward a number", detail: "From a baseline to a target, like 12 → 40 releases" },
  { value: "ManualPercentage", label: "A percentage the owner sets", detail: "The owner says how far along it is" },
  { value: "WeightedMilestones", label: "Weighted milestones", detail: "Done milestones add up by weight" },
];

const ALIGNMENT: { value: PlanAlignmentPolicy; label: string }[] = [
  { value: "EveryObjectiveConnected", label: "Every objective" },
  { value: "AtLeastOneConnected", label: "At least one objective" },
  { value: "Optional", label: "Not required" },
];

const CADENCE: { value: OneOnOneCadence; label: string }[] = [
  { value: "Weekly", label: "Weekly" },
  { value: "EveryTwoWeeks", label: "Every two weeks" },
  { value: "Monthly", label: "Monthly" },
];

/** What saving Planning does. */
export function planningConsequence(saved: Draft, draft: Draft): string {
  const s: string[] = [];
  if (saved.defaultMeasurementMethod !== draft.defaultMeasurementMethod)
    s.push(`New objectives start measured ${MEASUREMENT.find((m) => m.value === draft.defaultMeasurementMethod)?.label.toLowerCase()}.`);
  if (saved.suggestedObjectiveCountMin !== draft.suggestedObjectiveCountMin || saved.suggestedObjectiveCountMax !== draft.suggestedObjectiveCountMax)
    s.push(`Plans suggest ${draft.suggestedObjectiveCountMin} to ${draft.suggestedObjectiveCountMax} objectives.`);
  if (saved.planningDeadlineOffsetDays !== draft.planningDeadlineOffsetDays)
    s.push(`Plans in new cycles are due ${days(draft.planningDeadlineOffsetDays)} after the cycle starts.`);
  if (saved.planAlignmentPolicy !== draft.planAlignmentPolicy)
    s.push(
      draft.planAlignmentPolicy === "Optional"
        ? "Plans in new cycles don't need to connect to company objectives."
        : `Plans in new cycles connect ${draft.planAlignmentPolicy === "EveryObjectiveConnected" ? "every objective" : "at least one objective"} to company objectives.`
    );
  if (s.length) s.push("Cycles already active keep theirs.");
  return joinConsequences(s);
}

export function conversationsConsequence(saved: Draft, draft: Draft): string {
  if (saved.defaultOneOnOneCadence === draft.defaultOneOnOneCadence) return "";
  const label = CADENCE.find((c) => c.value === draft.defaultOneOnOneCadence)?.label.toLowerCase();
  return `New 1:1 series start ${label}. Series already running keep their rhythm.`;
}

export function aiAndDataConsequence(saved: Draft, draft: Draft): string {
  const s: string[] = [];
  if (saved.aiAssistanceEnabled !== draft.aiAssistanceEnabled)
    s.push(draft.aiAssistanceEnabled ? "Suggestions come back for everyone." : "Suggestions disappear everywhere at once, open reviews included.");
  if (saved.evidenceRetentionMonths !== draft.evidenceRetentionMonths)
    s.push(`Evidence is kept ${draft.evidenceRetentionMonths} months after its cycle closes, closed cycles included.`);
  return joinConsequences(s);
}

function toRequest(saved: Draft, draft: Draft): CycleSettingsRequest {
  const { nineBoxBands, ...rest } = draft;
  const bandsChanged = nineBoxBands.lowTop !== saved.nineBoxBands.lowTop || nineBoxBands.midTop !== saved.nineBoxBands.midTop;
  return {
    ...rest,
    expectedVersion: saved.version,
    ...(bandsChanged ? { nineBoxBands: { lowTop: nineBoxBands.lowTop, midTop: nineBoxBands.midTop } } : {}),
  };
}

function failure(error: unknown, label: string): string | null {
  if (!error) return null;
  return error instanceof ApiError && error.errors[0] ? error.errors[0] : `${label} didn't save. Try again.`;
}

/**
 * The frame every cycle-settings section shares: the saved values, staged edits, the save bar with the section's
 * consequence, and the conflict naming whoever saved one of the four sections first.
 */
function CycleSettingsSection({
  section,
  consequence,
  children,
}: {
  section: FusionSettingsSection;
  consequence: (saved: Draft, draft: Draft) => string;
  children: (draft: Draft, update: Update, editable: boolean) => ReactNode;
}) {
  const editable = section.access === "manage";
  const query = useSettings();
  const save = useSaveCycleSettings();
  const saved = query.data;
  const { mutateAsync } = save;
  const persist = useCallback((draft: Draft) => mutateAsync(toRequest(saved!, draft)), [mutateAsync, saved]);
  const staged = useStagedSettings(saved, persist, {
    ignore: ["version", "custom"],
    onReload: () => void query.refetch(),
    leaveMessage: `Leave without saving? Your changes to ${section.label} are discarded.`,
  });
  const saver = useSettingsConflictSaver("performance", CYCLE_SETTINGS_SECTIONS, staged.conflict);

  if (query.error && !saved) {
    return (
      <SettingsPage title={section.label}>
        <PageError title={`${section.label} didn't load`} onRetry={() => void query.refetch()} />
      </SettingsPage>
    );
  }

  const draft = staged.draft;
  return (
    <SettingsPage title={section.label} lastChange={section.lastChange} setUpAt={section.setUpAt} viewOnly={!editable} loading={!draft}>
      {draft ? children(draft, staged.update, editable) : null}
      {editable && saved && draft ? (
        <SettingsSaveBar
          changes={staged.changes}
          consequence={consequence(saved, draft)}
          saving={staged.saving}
          error={failure(staged.error, section.label)}
          conflict={saver}
          conflictPending={staged.conflict && !saver}
          onDiscard={staged.discard}
          onSave={() => void staged.submit()}
          onReload={staged.reload}
        />
      ) : null}
    </SettingsPage>
  );
}

function DaysField({
  id,
  label,
  value,
  unit,
  min,
  max,
  editable,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  editable: boolean;
  onChange: (value: number) => void;
}) {
  if (!editable) return <SettingsValue>{`${value} ${unit}`}</SettingsValue>;
  return (
    <>
      <Input
        id={id}
        aria-label={label}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : ""}
        onChange={(event) => onChange(event.target.valueAsNumber)}
        className="h-9 w-16 text-center font-semibold tabular-nums"
      />
      <span className="type-meta text-muted-foreground">{unit}</span>
    </>
  );
}

function Toggle({ id, checked, editable, onChange }: { id: string; checked: boolean; editable: boolean; onChange: (value: boolean) => void }) {
  return editable ? <Switch id={id} checked={checked} onCheckedChange={onChange} /> : <SettingsValue>{checked ? "On" : "Off"}</SettingsValue>;
}

/** Choice cards for a setting with a few named options. */
function Choices<T extends string>({
  label,
  value,
  options,
  editable,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; detail?: string }[];
  editable: boolean;
  onChange: (value: T) => void;
}) {
  if (!editable) {
    const chosen = options.find((option) => option.value === value);
    return (
      <SettingsRows>
        <SettingsRow label={chosen?.label ?? value} description={chosen?.detail} />
      </SettingsRows>
    );
  }
  return (
    <RadioGroup aria-label={label} value={value} onValueChange={(next) => onChange(next as T)} className="gap-3">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <label
            key={option.value}
            htmlFor={`${label}-${option.value}`}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-surface border px-5 py-4 transition-colors",
              selected ? "border-primary bg-primary-tint" : "border-border bg-card hover:border-foreground/30"
            )}
          >
            <RadioGroupItem id={`${label}-${option.value}`} value={option.value} className="mt-0.5" />
            <span className="flex flex-col gap-0.5">
              <span className="type-label font-semibold text-foreground">{option.label}</span>
              {option.detail ? <span className="type-meta text-muted-foreground">{option.detail}</span> : null}
            </span>
          </label>
        );
      })}
    </RadioGroup>
  );
}

/** Where calibration splits the scale: two cut points over its levels, each band holding at least one level. */
function NineBoxBands({
  levels,
  lowTop,
  midTop,
  editable,
  onChange,
}: {
  levels: RatingScaleLevelDto[];
  lowTop: number;
  midTop: number;
  editable: boolean;
  onChange: (lowTop: number, midTop: number) => void;
}) {
  const count = levels.length;
  const lowIndex = levels.findIndex((level) => level.value === lowTop) + 1;
  const midIndex = levels.findIndex((level) => level.value === midTop) + 1;
  const band = (index: number) => (index < lowIndex ? "low" : index < midIndex ? "middle" : "high");
  const range = (from: number, to: number) => {
    const a = levels[from]?.value;
    const b = levels[to]?.value;
    return a === b ? `${a}` : `${a}–${b}`;
  };
  return (
    <div className="flex flex-col gap-4 rounded-surface border border-border bg-card p-5">
      <p className="type-meta text-muted-foreground">Where calibration splits the rating scale into low, middle and high</p>
      <div className="relative">
        <ol className="grid overflow-hidden rounded-control border border-border" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
          {levels.map((level, index) => (
            <li
              key={level.value}
              className={cn(
                "flex min-w-0 flex-col gap-0.5 px-3 py-2.5",
                band(index) === "low" ? "bg-inlay" : band(index) === "middle" ? "bg-info-subtle" : "bg-primary-tint",
                index > 0 && "border-l border-border"
              )}
            >
              <span className="type-meta tabular-nums text-muted-foreground">{level.value}</span>
              <span className="truncate text-sm font-semibold text-foreground">{level.label}</span>
            </li>
          ))}
        </ol>
        {editable && count >= 3 ? (
          // The thumbs sit on the boundaries between levels: boundary k is after the k-th level.
          <Slider
            aria-label="Nine-box cut points"
            min={1}
            max={count - 1}
            step={1}
            minStepsBetweenThumbs={1}
            value={[lowIndex, midIndex]}
            onValueChange={([low, mid]) => onChange(levels[low! - 1]!.value, levels[mid! - 1]!.value)}
            className="absolute top-1/2 -translate-y-1/2"
            style={{ left: `${100 / count}%`, width: `${(100 * (count - 2)) / count}%` }}
          />
        ) : null}
      </div>
      <div className="grid grid-cols-3 text-sm">
        <span className="flex flex-col">
          <span className="font-semibold text-foreground">Low</span>
          <span className="type-meta tabular-nums text-muted-foreground">{range(0, lowIndex - 1)}</span>
        </span>
        <span className="flex flex-col items-center">
          <span className="font-semibold text-foreground">Middle</span>
          <span className="type-meta tabular-nums text-muted-foreground">{range(lowIndex, midIndex - 1)}</span>
        </span>
        <span className="flex flex-col items-end">
          <span className="font-semibold text-foreground">High</span>
          <span className="type-meta tabular-nums text-muted-foreground">{range(midIndex, count - 1)}</span>
        </span>
      </div>
    </div>
  );
}

/** Settings › Reviews: what a review includes, its due-date defaults and the nine-box bands. */
export function ReviewsSettings({ section }: { section: FusionSettingsSection }) {
  const scale = useRatingScale();
  return (
    <CycleSettingsSection section={section} consequence={reviewsConsequence}>
      {(draft, update, editable) => (
        <>
          <SettingsBlock title="What a review includes">
            <SettingsRows>
              <SettingsRow label="Self-assessment" htmlFor={editable ? "include-self" : undefined}>
                <Toggle id="include-self" checked={draft.defaultSelfAssessmentEnabled} editable={editable}
                  onChange={(value) => update((d) => ({ ...d, defaultSelfAssessmentEnabled: value }))} />
              </SettingsRow>
              <SettingsRow label="A rating for each objective" htmlFor={editable ? "include-ratings" : undefined}>
                <Toggle id="include-ratings" checked={draft.defaultObjectiveRatingsEnabled} editable={editable}
                  onChange={(value) => update((d) => ({ ...d, defaultObjectiveRatingsEnabled: value }))} />
              </SettingsRow>
              <SettingsRow label="Calibration before results are released" htmlFor={editable ? "include-calibration" : undefined}>
                <Toggle id="include-calibration" checked={draft.defaultCalibrationEnabled} editable={editable}
                  onChange={(value) => update((d) => ({ ...d, defaultCalibrationEnabled: value }))} />
              </SettingsRow>
            </SettingsRows>
          </SettingsBlock>

          <SettingsBlock title="Due dates">
            <SettingsRows>
              <SettingsRow label="Self-assessment" htmlFor={editable ? "due-self" : undefined}>
                <DaysField id="due-self" label="Self-assessment due, in days after launch" value={draft.selfAssessmentDueDays} unit="days after launch"
                  min={1} max={60} editable={editable} onChange={(value) => update((d) => ({ ...d, selfAssessmentDueDays: value }))} />
              </SettingsRow>
              <SettingsRow label="Peer input" htmlFor={editable ? "due-peer" : undefined}>
                <DaysField id="due-peer" label="Peer input due, in days after launch" value={draft.peerInputDueDays} unit="days after launch"
                  min={1} max={60} editable={editable} onChange={(value) => update((d) => ({ ...d, peerInputDueDays: value }))} />
              </SettingsRow>
              <SettingsRow label="Manager assessment" htmlFor={editable ? "due-manager" : undefined}>
                <DaysField id="due-manager" label="Manager assessment due, in days after the self-assessment" value={draft.managerAssessmentDueDays}
                  unit="days after the self-assessment" min={1} max={60} editable={editable}
                  onChange={(value) => update((d) => ({ ...d, managerAssessmentDueDays: value }))} />
              </SettingsRow>
              <SettingsRow label="Acknowledgement reminder" htmlFor={editable ? "due-ack" : undefined}>
                <DaysField id="due-ack" label="Acknowledgement reminder, in days after release" value={draft.acknowledgementReminderDays}
                  unit="days after release" min={1} max={30} editable={editable}
                  onChange={(value) => update((d) => ({ ...d, acknowledgementReminderDays: value }))} />
              </SettingsRow>
            </SettingsRows>
          </SettingsBlock>

          <SettingsBlock title="Nine-box performance bands">
            {scale.data ? (
              <NineBoxBands
                levels={scale.data.levels}
                lowTop={draft.nineBoxBands.lowTop}
                midTop={draft.nineBoxBands.midTop}
                editable={editable}
                onChange={(lowTop, midTop) => update((d) => ({ ...d, nineBoxBands: { ...d.nineBoxBands, lowTop, midTop } }))}
              />
            ) : (
              <SettingsRows>
                <SettingsRow label="Bands">
                  <SettingsValue>{`Low up to ${draft.nineBoxBands.lowTop}, middle up to ${draft.nineBoxBands.midTop}`}</SettingsValue>
                </SettingsRow>
              </SettingsRows>
            )}
          </SettingsBlock>
        </>
      )}
    </CycleSettingsSection>
  );
}

/** Settings › Planning: the defaults every new cycle copies. */
export function PlanningSettings({ section }: { section: FusionSettingsSection }) {
  return (
    <CycleSettingsSection section={section} consequence={planningConsequence}>
      {(draft, update, editable) => (
        <>
          <SettingsBlock title="How progress is measured">
            <Choices label="How progress is measured" value={draft.defaultMeasurementMethod} options={MEASUREMENT} editable={editable}
              onChange={(value) => update((d) => ({ ...d, defaultMeasurementMethod: value }))} />
          </SettingsBlock>
          <SettingsBlock title="Plans">
            <SettingsRows>
              <SettingsRow label="Objectives per plan">
                {editable ? (
                  <>
                    <Input aria-label="Fewest objectives per plan" type="number" min={1} max={20} value={draft.suggestedObjectiveCountMin}
                      onChange={(event) => update((d) => ({ ...d, suggestedObjectiveCountMin: event.target.valueAsNumber }))}
                      className="h-9 w-16 text-center font-semibold tabular-nums" />
                    <span className="type-meta text-muted-foreground">to</span>
                    <Input aria-label="Most objectives per plan" type="number" min={1} max={20} value={draft.suggestedObjectiveCountMax}
                      onChange={(event) => update((d) => ({ ...d, suggestedObjectiveCountMax: event.target.valueAsNumber }))}
                      className="h-9 w-16 text-center font-semibold tabular-nums" />
                  </>
                ) : (
                  <SettingsValue>{`${draft.suggestedObjectiveCountMin} to ${draft.suggestedObjectiveCountMax}`}</SettingsValue>
                )}
              </SettingsRow>
              <SettingsRow label="Plans due" htmlFor={editable ? "plans-due" : undefined}>
                <DaysField id="plans-due" label="Plans due, in days after the cycle starts" value={draft.planningDeadlineOffsetDays} unit="days after start"
                  min={1} max={365} editable={editable} onChange={(value) => update((d) => ({ ...d, planningDeadlineOffsetDays: value }))} />
              </SettingsRow>
            </SettingsRows>
          </SettingsBlock>
          <SettingsBlock title="Alignment to company objectives">
            <SettingsRows>
              <SettingsRow label="Required" htmlFor={editable ? "alignment" : undefined}>
                {editable ? (
                  <NativeSelect id="alignment" value={draft.planAlignmentPolicy} className="w-56"
                    onChange={(event) => update((d) => ({ ...d, planAlignmentPolicy: event.target.value as PlanAlignmentPolicy }))}>
                    {ALIGNMENT.map((option) => (
                      <NativeSelectOption key={option.value} value={option.value}>{option.label}</NativeSelectOption>
                    ))}
                  </NativeSelect>
                ) : (
                  <SettingsValue>{ALIGNMENT.find((option) => option.value === draft.planAlignmentPolicy)?.label}</SettingsValue>
                )}
              </SettingsRow>
            </SettingsRows>
          </SettingsBlock>
        </>
      )}
    </CycleSettingsSection>
  );
}

/** Settings › Conversations: the rhythm new 1:1 series start with. */
export function ConversationsSettings({ section }: { section: FusionSettingsSection }) {
  return (
    <CycleSettingsSection section={section} consequence={conversationsConsequence}>
      {(draft, update, editable) => (
        <SettingsBlock title="1:1 rhythm">
          <Choices label="1:1 rhythm" value={draft.defaultOneOnOneCadence} options={CADENCE} editable={editable}
            onChange={(value) => update((d) => ({ ...d, defaultOneOnOneCadence: value }))} />
        </SettingsBlock>
      )}
    </CycleSettingsSection>
  );
}

/** Settings › AI and data: one switch for Performance AI, and how long evidence is kept. */
export function AiAndDataSettings({ section }: { section: FusionSettingsSection }) {
  return (
    <CycleSettingsSection section={section} consequence={aiAndDataConsequence}>
      {(draft, update, editable) => (
        <>
          <SettingsBlock title="AI assistance">
            <SettingsRows>
              <SettingsRow label="Suggestions in Performance" description="Plan coach, review starters, calibration summaries"
                htmlFor={editable ? "ai-assistance" : undefined}>
                <Toggle id="ai-assistance" checked={draft.aiAssistanceEnabled} editable={editable}
                  onChange={(value) => update((d) => ({ ...d, aiAssistanceEnabled: value }))} />
              </SettingsRow>
            </SettingsRows>
          </SettingsBlock>
          <SettingsBlock title="Evidence">
            <SettingsRows>
              <SettingsRow label="Keep files attached to objectives" htmlFor={editable ? "evidence-retention" : undefined}>
                <DaysField id="evidence-retention" label="Keep evidence, in months after its cycle closes" value={draft.evidenceRetentionMonths}
                  unit="months" min={1} max={120} editable={editable} onChange={(value) => update((d) => ({ ...d, evidenceRetentionMonths: value }))} />
              </SettingsRow>
            </SettingsRows>
          </SettingsBlock>
        </>
      )}
    </CycleSettingsSection>
  );
}
