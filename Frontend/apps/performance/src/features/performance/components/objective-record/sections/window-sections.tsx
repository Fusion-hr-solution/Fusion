import { CalendarDays, PieChart } from "@/lib/icons";
import { CycleTimeline } from "../../cycle-setup/cycle-timeline";
import { pct } from "../../plan/plan-lib";
import { todayMarker, windowLength, type ObjectiveRecord } from "../objective-record-model";
import { RecordCard } from "./record-primitives";

/** The objective's window read as a start→end sequence, with today marked while it runs. */
export function TimelineSection({ record, compact }: { record: ObjectiveRecord; compact: boolean }) {
  return (
    <RecordCard
      icon={<CalendarDays className="size-5" aria-hidden />}
      title="Timeline"
      subtitle={windowLength(record.startDate, record.endDate)}
    >
      <CycleTimeline
        startDate={record.startDate}
        endDate={record.endDate}
        startLabel="Starts"
        endLabel="Ends"
        marker={todayMarker(record.startDate, record.endDate)}
        compact
        orientation={compact ? "vertical" : "horizontal"}
        accent="var(--type-accent)"
      />
    </RecordCard>
  );
}

/** A plan objective's share of its plan, read as a single gauge. */
export function PlanWeightSection({ record }: { record: ObjectiveRecord }) {
  return (
    <RecordCard icon={<PieChart className="size-5" aria-hidden />} title="Plan weight" subtitle="Share of overall plan">
      <div className="flex items-center justify-center pt-1">
        <WeightDonut value={record.planWeight ?? 0} />
      </div>
    </RecordCard>
  );
}

/** The plan share as a single ring gauge with the percentage at its center — no legend, no second figure. */
function WeightDonut({ value }: { value: number }) {
  const size = 104;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  const dash = (clamped / 100) * c;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted-foreground/20" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          className={clamped > 0 ? "stroke-(--type-accent)" : "stroke-transparent"}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-semibold tabular-nums text-foreground">{pct(value)}%</span>
      </div>
    </div>
  );
}
