"use client";

import { statusMix } from "@repo/performance-ui";
import type { EmployeePlanDto } from "@repo/api";
import { AllocationGauge } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { SidebarSection } from "./plan-layout";
import { progressPct } from "./plan-lib";
import { useTranslations } from "next-intl";

/**
 * The canonical weighted Plan-progress read — one presentation over one calculation (`plan.planProgress`),
 * shared by the employee's own plan and the manager's read of it so both see the same figure and breakdown.
 * Before any objective is updated it holds an empty ring and says so honestly — missing is not 0%. Once
 * progress exists it shows the derived weighted figure; the per-objective breakdown is the objective rows
 * themselves, so the sidebar does not restate it. Colour stays
 * non-judgmental. The empty-state hint is caller-supplied: the owner is nudged to update; the manager sees
 * only the neutral fact, with no action that isn't theirs.
 */
export function PlanProgressCard({
  plan,
  emptyDescription,
}: {
  plan: EmployeePlanDto;
  /** Optional line under the empty state — the owner's nudge to begin; omitted for a manager's read. */
  emptyDescription?: string;
}) {
  const t = useTranslations("plan.PlanProgressCard");
  const anyProgress = plan.objectives.some((o) => o.hasProgress);
  const complete = plan.planProgress >= 100;

  if (!anyProgress) {
    return (
      <SidebarSection label={t("planProgress")}>
        <div className="mt-4 flex flex-col items-center text-center">
          <AllocationGauge
            value={0}
            tone="var(--muted-foreground)"
            centerValue="—"
            centerClassName="text-muted-foreground"
            height={160}
          />
          <p className="mt-4 type-panel-title text-foreground">{t("noProgressReportedYet")}</p>
          {emptyDescription ? (
            <p className="mt-1 max-w-[16rem] type-meta leading-relaxed text-muted-foreground">{emptyDescription}</p>
          ) : null}
          <StatusMixLine plan={plan} />
        </div>
      </SidebarSection>
    );
  }

  return (
    <SidebarSection label={t("planProgress")}>
      <div className="mt-4 flex flex-col items-center text-center">
        <ObjectiveProgressRing plan={plan} complete={complete} />
        <p className="mt-3 type-meta text-muted-foreground">{t("weightedAcrossObjectives", { length: plan.objectives.length })}</p>
        <StatusMixLine plan={plan} />
      </div>

    </SidebarSection>
  );
}

/** How the owners say their objectives are going (D-05), once any has reported: "2 on track · 1 at risk". */
function StatusMixLine({ plan }: { plan: EmployeePlanDto }) {
  const t = useTranslations("plan.StatusMixLine");
  const mix = statusMix(plan.objectives.map((o) => o.status));
  if (mix.notReported === plan.objectives.length) return null;
  return (
    <p className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 type-meta text-muted-foreground">
      {mix.onTrack > 0 ? <MixItem dot="bg-success" label={t("onTrack", { onTrack: mix.onTrack })} /> : null}
      {mix.atRisk > 0 ? <MixItem dot="bg-warning" label={t("atRisk", { atRisk: mix.atRisk })} /> : null}
      {mix.offTrack > 0 ? <MixItem dot="bg-destructive" label={t("offTrack", { offTrack: mix.offTrack })} /> : null}
      {mix.notReported > 0 ? <MixItem dot="bg-muted-foreground/40" label={t("notReported", { notReported: mix.notReported })} /> : null}
    </p>
  );
}

function MixItem({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-1.5 rounded-full", dot)} aria-hidden />
      {label}
    </span>
  );
}

const RING = 160;
const STROKE = 13;
const GAP = 3; // px of track between adjacent segments

/**
 * Plan progress as each objective's share of it: one arc per objective, sized by what it contributes
 * (its progress, capped at 100%, times its plan weight — the same sum as `plan.planProgress`) and
 * coloured by its type, amber when aligned and blue when standalone, matching its row.
 */
function ObjectiveProgressRing({ plan, complete }: { plan: EmployeePlanDto; complete: boolean }) {
  const t = useTranslations("plan.ObjectiveProgressRing");
  const r = (RING - STROKE) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const segments = plan.objectives
    .map((o) => ({
      id: o.id,
      aligned: o.isAligned,
      share: o.hasProgress ? (Math.min(o.derivedProgress, 100) * (o.planWeight ?? 0)) / 100 : 0,
    }))
    .filter((s) => s.share > 0)
    .map((s) => {
      const length = (s.share / 100) * c;
      const seg = { ...s, start: offset, length };
      offset += length;
      return seg;
    });

  return (
    <div className="relative" style={{ width: RING, height: RING }}>
      <svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} className="-rotate-90" aria-hidden>
        <circle cx={RING / 2} cy={RING / 2} r={r} fill="none" strokeWidth={STROKE} className="stroke-muted" />
        {segments.map((s) => {
          const visible = Math.max(s.length - (segments.length > 1 ? GAP : 0), 1);
          return (
            <circle
              key={s.id}
              cx={RING / 2}
              cy={RING / 2}
              r={r}
              fill="none"
              strokeWidth={STROKE}
              strokeLinecap="butt"
              strokeDasharray={`${visible} ${c - visible}`}
              strokeDashoffset={-s.start}
              // Progress is the fill (amber, DESIGN §2); status lives in the legend below, so the two never share a colour.
              className="stroke-primary"
            />
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("type-metric", complete ? "text-success" : "text-foreground")}>
          {progressPct(plan.planProgress)}%
        </span>
        <span className="mt-1.5 type-meta text-muted-foreground">{t("overallProgress")}</span>
      </div>
    </div>
  );
}
