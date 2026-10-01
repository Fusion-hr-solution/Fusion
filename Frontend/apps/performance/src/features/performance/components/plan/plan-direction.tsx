"use client";

import { useMemo, useState } from "react";
import { Landmark, SquareArrowEnter } from "@/lib/icons";
import type { AlignmentTargetDto, PlanDecisionDto, PlanObjectiveDto } from "@repo/api";
import { Avatar, AvatarFallback } from "@repo/ds/components/ui/avatar";
import { ScopeMark } from "../scope-mark";
import { OrgObjectiveDetailDrawer } from "../goals/org-objective-detail-drawer";
import { SidebarSection } from "./plan-layout";
import { initials } from "./plan-lib";
import { formatDate } from "../../lib";
import { useWorkforceMe } from "../../api/use-workforce-me";

export interface DirectionLevel {
  key: string;
  scope: string;
  title: string;
}

/**
 * The plan's direction as a sidebar property: the objective the plan serves, linked down a quiet
 * connector to the objective it supports, each with its scope. Same resolution as the banner; read-only,
 * each level opens its objective in the detail drawer. Renders nothing when there is no direction yet.
 */
export function PlanDirectionSection({
  cycleId,
  objectives,
  targets,
  directionLevels,
}: {
  cycleId: string;
  objectives: PlanObjectiveDto[];
  targets: AlignmentTargetDto[];
  directionLevels?: DirectionLevel[];
}) {
  const derived = useMemo(() => resolveDirection(objectives, targets), [objectives, targets]);
  const levels = (directionLevels ?? derived).slice(0, 2);
  const idByTitle = useMemo(() => new Map(targets.map((t) => [t.title, t.id])), [targets]);
  const [openId, setOpenId] = useState<string | null>(null);
  if (levels.length === 0) return null;

  return (
    <SidebarSection label="Direction">
      <ol className="mt-4">
        {levels.map((level, index) => {
          const leading = index === 0;
          const objectiveId = idByTitle.get(level.title);
          return (
            <li key={level.key} className="relative flex gap-3 pb-5 last:pb-0">
              {index < levels.length - 1 ? (
                <span className="absolute bottom-0 left-4 top-9 w-px -translate-x-1/2 bg-border" aria-hidden />
              ) : null}
              <span
                className={
                  leading
                    ? "flex size-8 shrink-0 items-center justify-center rounded-control bg-primary-tint text-primary-ink ring-1 ring-primary-ring"
                    : "flex size-8 shrink-0 items-center justify-center rounded-control border border-border text-muted-foreground"
                }
              >
                {leading ? <ScopeMark className="size-5" /> : <Landmark className="size-4" aria-hidden />}
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className={leading ? "text-sm font-semibold leading-snug text-foreground" : "text-sm leading-snug text-foreground/85"}>
                  {level.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{level.scope}</p>
              </div>
              {objectiveId ? (
                <button
                  type="button"
                  onClick={() => setOpenId(objectiveId)}
                  aria-label={`Open ${level.title}`}
                  className="flex size-7 shrink-0 items-center justify-center rounded-detail text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <SquareArrowEnter className="size-4 -scale-x-100" aria-hidden />
                </button>
              ) : null}
            </li>
          );
        })}
      </ol>
      <OrgObjectiveDetailDrawer
        cycleId={cycleId}
        objectiveId={openId}
        open={openId !== null}
        onOpenChange={(open) => {
          if (!open) setOpenId(null);
        }}
      />
    </SidebarSection>
  );
}

const DECISION_LABEL: Partial<Record<PlanDecisionDto["kind"], string>> = {
  // Approval is stated (with its date) by the Approved & locked section, so it is not repeated here.
  Returned: "Returned your plan",
};

/**
 * Who holds the plan's agreement: the reviewer's identity, how they relate to the employee (their own
 * manager, when the workforce record says so), a direct line to reach them, and — once they have acted
 * on this plan — their latest decision. Only facts; nothing the rest of the page already states.
 */
export function PlanReviewerSection({
  reviewerId,
  reviewerName,
  history = [],
}: {
  reviewerId?: string | null;
  reviewerName: string | null;
  history?: PlanDecisionDto[];
}) {
  const me = useWorkforceMe(Boolean(reviewerName));
  if (!reviewerName) return null;

  const manager = me.data?.employee?.manager ?? null;
  const isManager = Boolean(manager && reviewerId && manager.employeeId === reviewerId);
  const email = isManager ? manager?.email ?? null : null;
  const lastDecision = [...history].reverse().find((h) => DECISION_LABEL[h.kind] && (!reviewerId || h.actorEmployeeId === reviewerId));

  return (
    <SidebarSection label="Reviewer">
      <div className="mt-4 flex items-center gap-3">
        <Avatar className="size-10">
          <AvatarFallback className="text-xs">{initials(reviewerName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{reviewerName}</p>
          {email ? (
            <a
              href={`mailto:${email}`}
              className="block truncate rounded-detail text-xs text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {email}
            </a>
          ) : null}
        </div>
      </div>

      {lastDecision ? (
        <dl className="mt-4 flex items-baseline justify-between gap-3 text-sm">
          <dt className="text-muted-foreground">{DECISION_LABEL[lastDecision.kind]}</dt>
          <dd className="shrink-0 tabular-nums text-foreground/85">{formatDate(lastDecision.decidedAt.slice(0, 10))}</dd>
        </dl>
      ) : null}
    </SidebarSection>
  );
}

/**
 * The plan's supported direction as a deepest-first chain of {scope, title}. Built from the longest
 * upstream path among the aligned objectives (the deepest connection the plan makes), with each
 * ancestor title matched to a published alignment target to recover its scope label.
 */
function resolveDirection(
  objectives: PlanObjectiveDto[],
  targets: AlignmentTargetDto[]
): DirectionLevel[] {
  const deepest = objectives
    .filter((o) => o.isAligned && o.directionPath.length > 0)
    .sort((a, b) => b.directionPath.length - a.directionPath.length)[0];
  if (!deepest) return [];

  const scopeByTitle = new Map<string, string>();
  for (const target of targets) {
    scopeByTitle.set(
      target.title,
      target.ownershipScope === "Company"
        ? "Company strategy"
        : (target.orgUnitName ?? "Organizational")
    );
  }

  // directionPath is top-down (company → nearest); reverse so the employee's own level leads.
  return deepest.directionPath
    .map((title, index) => ({
      key: `${index}-${title}`,
      scope: scopeByTitle.get(title) ?? "Direction",
      title,
    }))
    .reverse();
}

/**
 * The direction an employee will plan against before any objective exists: the published objective
 * owned at their own org unit leads (their focus area), with its nearest parent named as what it
 * supports. Falls back to the deepest published objective when no target matches their unit. This
 * mirrors what {@link resolveDirection} recovers from a plan's aligned objectives.
 */
export function directionFromTargets(
  targets: AlignmentTargetDto[],
  orgUnitName: string | null | undefined
): DirectionLevel[] {
  if (targets.length === 0) return [];

  const scopeLabel = (t: AlignmentTargetDto) =>
    t.ownershipScope === "Company"
      ? "Company strategy"
      : (t.orgUnitName ?? "Organizational");
  const scopeByTitle = new Map<string, string>();
  for (const t of targets) scopeByTitle.set(t.title, scopeLabel(t));

  const own = orgUnitName
    ? targets.find((t) => t.orgUnitName === orgUnitName)
    : undefined;
  const leading =
    own ??
    [...targets].sort(
      (a, b) => b.directionPath.length - a.directionPath.length
    )[0];
  if (!leading) return [];

  const levels: DirectionLevel[] = [
    {
      key: `own-${leading.id}`,
      scope: scopeLabel(leading),
      title: leading.title,
    },
  ];
  const parentTitle = leading.directionPath.at(-1);
  if (parentTitle) {
    levels.push({
      key: `parent-${parentTitle}`,
      scope: scopeByTitle.get(parentTitle) ?? "Direction",
      title: parentTitle,
    });
  }
  return levels;
}
