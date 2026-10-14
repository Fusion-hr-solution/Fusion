import type { MeasurementDto, ObjectiveProgressSource } from "@repo/api";
import { BarChart3, FileText, Layers, Milestones, Percent, Target } from "@/lib/icons";
import { MilestoneDue } from "../../measurement/milestone-due";
import { TargetRange } from "../../plan/target-range";
import { MEASUREMENT_METHOD_LABEL, pct } from "../../plan/plan-lib";
import { measureLabel, measurementSubtitle } from "../objective-record-model";
import { MiniFact, RecordCard } from "./record-primitives";

/**
 * How the objective is measured: the method, what is counted, and — by method — the numeric target or
 * the weighted milestone list. Exported on its own so any surface that needs an objective's baseline
 * (a review, for one) composes this section rather than the whole record.
 */
export function MeasurementSection({
  measurement,
  progressSource,
  showMilestones = true,
}: {
  measurement: MeasurementDto | null;
  progressSource?: ObjectiveProgressSource;
  showMilestones?: boolean;
}) {
  return (
    <RecordCard
      icon={<BarChart3 className="size-5" aria-hidden />}
      title="Measurement"
      subtitle={measurementSubtitle(measurement, progressSource)}
    >
      {progressSource === "Calculated" ? (
        <MiniFact icon={<Layers className="size-4" aria-hidden />} label="Type" value="Calculated from contributors" />
      ) : (
        <MeasurementFacts measurement={measurement} showMilestones={showMilestones} />
      )}
    </RecordCard>
  );
}

function MeasurementFacts({ measurement, showMilestones }: { measurement: MeasurementDto | null; showMilestones: boolean }) {
  const milestones = measurement?.method === "WeightedMilestones" ? measurement.milestones : null;
  return (
    <>
      <div className="@container">
        <div className="grid gap-3 @xs:grid-cols-2">
          <MiniFact
            icon={<FileText className="size-4" aria-hidden />}
            label="Type"
            value={measurement ? MEASUREMENT_METHOD_LABEL[measurement.method] : "—"}
          />
          {milestones ? (
            <MiniFact
              icon={<Milestones className="size-4" aria-hidden />}
              label="Milestones"
              value={`${milestones.length} milestone${milestones.length === 1 ? "" : "s"}`}
            />
          ) : (
            <MiniFact icon={<Percent className="size-4" aria-hidden />} label="Measure" value={measureLabel(measurement)} />
          )}
        </div>
      </div>

      {measurement?.method === "NumericTarget" ? (
        <div className="mt-3">
          <MiniFact
            icon={<Target className="size-4" aria-hidden />}
            label="Target"
            value={
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <TargetRange
                  baseline={measurement.baseline}
                  target={measurement.target}
                  unit={measurement.unit}
                  direction={measurement.direction}
                />
              </span>
            }
          />
        </div>
      ) : null}

      {showMilestones && milestones && milestones.length > 0 ? (
        <ul className="mt-3 divide-y divide-border rounded-surface border border-border bg-inlay dark:bg-popover">
          {milestones.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-3.5 py-2.5 text-sm">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-popover text-muted-foreground dark:bg-card">
                <Milestones className="size-3.5" aria-hidden />
              </span>
              <span className="min-w-[8rem] flex-1 font-medium break-words text-foreground">{m.title}</span>
              <MilestoneDue milestone={m} />
              <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">{pct(m.weight)}%</span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
