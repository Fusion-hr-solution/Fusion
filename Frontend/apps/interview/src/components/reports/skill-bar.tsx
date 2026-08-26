import { cn } from "@/lib/utils";
import type { CandidateReportSkill } from "@/types";
import { formatDuration, formatPct, formatSignedPct } from "./format";

/**
 * One skill axis as a horizontal bar. Colour is by GAP vs. the cohort (not absolute score): at/above
 * the cohort is green, a little below is amber, well below is red. Without a cohort it stays neutral.
 * The fill animates in with a per-row stagger so the profile "draws" top-to-bottom.
 */
interface SkillBarProps {
  skill: CandidateReportSkill;
  index: number;
  showCohort: boolean;
  hasTiming: boolean;
}

const AMBER_GAP = -15; // within 15 points below the cohort → amber; beyond → red

function gapStyles(scorePct: number, cohortAvgPct?: number): { fill: string; delta: string } {
  if (cohortAvgPct == null) {
    return { fill: "bg-indigo-500", delta: "text-zinc-400" };
  }
  const gap = scorePct - cohortAvgPct;
  if (gap >= 0) {
    return { fill: "bg-emerald-500", delta: "text-emerald-600" };
  }
  if (gap >= AMBER_GAP) {
    return { fill: "bg-amber-500", delta: "text-amber-600" };
  }
  return { fill: "bg-red-500", delta: "text-red-600" };
}

export function SkillBar({ skill, index, showCohort, hasTiming }: SkillBarProps) {
  const clamped = Math.max(0, Math.min(100, skill.scorePct));
  const showTick = showCohort && skill.cohortAvgPct != null;
  const styles = gapStyles(skill.scorePct, showCohort ? skill.cohortAvgPct : undefined);
  const delta = skill.cohortAvgPct != null ? skill.scorePct - skill.cohortAvgPct : null;

  return (
    <div className="py-2">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="truncate text-[13px] font-medium text-zinc-800" title={skill.key}>
          {skill.key}
        </span>
        <span className="flex shrink-0 items-baseline gap-2 text-[12px]">
          <span className="font-semibold text-zinc-900">{formatPct(skill.scorePct)}</span>
          {showCohort && delta != null ? (
            <span className={cn("font-medium tabular-nums", styles.delta)}>
              {formatSignedPct(delta)} vs cohort
            </span>
          ) : null}
        </span>
      </div>

      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className={cn("h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none", styles.fill)}
          style={{ width: `${clamped}%`, transitionDelay: `${Math.min(index, 8) * 60}ms` }}
        />
        {showTick ? (
          <span
            className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full bg-zinc-500"
            style={{ left: `calc(${Math.max(0, Math.min(100, skill.cohortAvgPct ?? 0))}% - 1px)` }}
            aria-hidden="true"
          />
        ) : null}
      </div>

      <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-400">
        <span>
          {skill.questionCount} question{skill.questionCount === 1 ? "" : "s"}
        </span>
        {hasTiming ? (
          <span>
            {formatDuration(skill.secondsSpent)} / {formatDuration(skill.allottedSeconds)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
