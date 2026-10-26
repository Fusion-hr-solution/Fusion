import type { ReactNode } from "react";
import type { MeasurementDto, ObjectiveProgressSource } from "@repo/api";
import { formatDateRange } from "@repo/ds/lib/dates";
import { MilestoneDue } from "../../measurement/milestone-due";
import { TargetRange } from "../../plan/target-range";
import { MEASUREMENT_METHOD_LABEL, pct } from "../../plan/plan-lib";
import { measureLabel, type ObjectiveRecord } from "../objective-record-model";

/** One property of the objective: a quiet label and its value, rows separated by hairlines. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="shrink-0 type-meta text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-end type-label text-foreground">{children}</dd>
    </div>
  );
}

function MeasureFacts({ measurement, progressSource }: { measurement: MeasurementDto | null; progressSource?: ObjectiveProgressSource }) {
  if (progressSource === "Calculated") return <Fact label="Measured by">Contributing objectives</Fact>;
  const milestones = measurement?.method === "WeightedMilestones" ? measurement.milestones : null;
  return (
    <>
      <Fact label="Measured by">
        {measurement ? MEASUREMENT_METHOD_LABEL[measurement.method] : "–"}
        {milestones ? <span className="type-meta text-muted-foreground"> · {milestones.length}</span> : null}
      </Fact>
      {measurement?.method === "NumericTarget" ? (
        <Fact label="Target">
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <TargetRange baseline={measurement.baseline} target={measurement.target} unit={measurement.unit} direction={measurement.direction} />
          </span>
        </Fact>
      ) : measurement?.method === "ManualPercentage" ? (
        <Fact label="Measure">{measureLabel(measurement)}</Fact>
      ) : null}
    </>
  );
}

function MilestoneList({ measurement }: { measurement: MeasurementDto | null }) {
  const milestones = measurement?.method === "WeightedMilestones" ? measurement.milestones : null;
  if (!milestones || milestones.length === 0) return null;
  return (
    <ul className="mt-2 divide-y divide-border rounded-surface bg-inlay">
      {milestones.map((m) => (
        <li key={m.id} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 px-3.5 py-2.5">
          <span className="min-w-[8rem] flex-1 break-words type-label text-foreground">{m.title}</span>
          <MilestoneDue milestone={m} />
          <span className="w-10 shrink-0 text-end type-meta tabular-nums text-muted-foreground">{pct(m.weight)}%</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * How the objective is measured, as properties: the method and its target or milestones. Used on its own where a
 * surface needs an objective's baseline (recording progress, a review).
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
    <section aria-label="Measurement">
      <dl className="divide-y divide-border">
        <MeasureFacts measurement={measurement} progressSource={progressSource} />
      </dl>
      {showMilestones ? <MilestoneList measurement={measurement} /> : null}
    </section>
  );
}

/**
 * What defines the objective besides its progress: how it's measured, when it runs and its share of the plan. One
 * hairline-separated property group (the record's sidebar on a page, its first block in the drawer), never a card
 * per fact.
 */
export function ObjectiveFactsSection({ record }: { record: ObjectiveRecord }) {
  return (
    <section aria-label="About this objective">
      <dl className="divide-y divide-border">
        <MeasureFacts measurement={record.measurement} progressSource={record.progressSource} />
        <Fact label="Runs">{formatDateRange(record.startDate.slice(0, 10), record.endDate.slice(0, 10))}</Fact>
        {record.planWeight != null ? <Fact label="Weight">{pct(record.planWeight)}% of the plan</Fact> : null}
      </dl>
      <MilestoneList measurement={record.measurement} />
    </section>
  );
}
