"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  CircleDashed,
  ExternalLink,
  Gauge,
  Layers,
  Pencil,
  Plus,
  Target,
  Trash2,
  Users,
  Waypoints,
} from "lucide-react";
import { toast } from "sonner";
import type {
  CycleSummaryDto,
  GoalNodeDto,
  ObjectiveProgressDto,
} from "@repo/api";
import { Avatar, AvatarFallback } from "@repo/ds/components/ui/avatar";
import { Button } from "@repo/ds/components/ui/button";
import { StatusBadge } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { ObjectiveContextPanel } from "../goals/objective-context-panel";
import {
  OrgComposerHost,
  type ComposerState,
} from "../goals/org-composer-host";
import { initials, STATE_LABEL, STATE_TONE } from "../goals/goals-lib";
import { MEASUREMENT_METHOD_LABEL, formatMeasureValue } from "../plan/plan-lib";
import {
  resolveWorkspace,
  type UnitContext,
} from "../goals/working-context-lib";
import {
  useGoalMutations,
  useGoals,
  useObjectiveProgress,
} from "../../api/use-performance";
import { useWorkforceMe } from "../../api/use-workforce-me";
import { formatDate } from "../../lib";
import { TeamObjectiveRecordDrawer } from "./team-objective-record-drawer";

/**
 * Team Direction — the manager's operational read of the direction their scope inherited and the
 * organizational objective their scope owns. The "team objective" here is NOT a Team-Performance copy:
 * it is the same canonical organizational objective used by Organization Goals, resolved through the
 * same `resolveWorkspace` derivation. Creating it opens the shared Organizational Objective Composer;
 * viewing it opens the shared objective panel; progress comes from the canonical objective-progress
 * truth. Organization Goals and Team Performance are two presentations of one resource.
 *
 * It is a scoped-leader concept: it renders only when the actor has a real organizational placement.
 * A tenant-wide/administration actor with no owning unit sees nothing here.
 */
export function TeamDirection({
  cycle,
  canViewOrgGoals,
}: {
  cycle: CycleSummaryDto;
  /** Whether the actor can legitimately open Organization Goals (gates the section-level link). */
  canViewOrgGoals: boolean;
}) {
  const me = useWorkforceMe(true);
  const goals = useGoals(cycle.id, true);
  const goalMutations = useGoalMutations(cycle.id);

  const ownUnit: UnitContext | null = useMemo(() => {
    const org = me.data?.employee?.orgUnit;
    if (!org) return null;
    return {
      orgUnitId: org.orgUnitId,
      name: org.name,
      type: org.type,
      path: org.path,
      memberCount: me.data?.orgUnitMemberCount ?? null,
      isOwnUnit: true,
    };
  }, [me.data]);

  // The manager's own scope, its inherited upstream direction, and the objective their scope owns
  // (if any) — all from the same canonical alignment derivation Organization Goals uses.
  const resolved = useMemo(() => {
    if (!ownUnit || !goals.data) return null;
    const workspace = resolveWorkspace(goals.data.nodes, {
      ownUnit,
      broad: false,
    });
    if (workspace.kind === "unit") {
      // The scope owns at least one objective. The team objective is its primary (first) one; its
      // direct parent is the inherited upstream direction.
      const block = workspace.blocks[0]!;
      return { upstream: block.ancestors.at(-1) ?? null, team: block.node };
    }
    if (workspace.kind === "unit-empty") {
      // No objective yet — the first published direction the scope could align under is the upstream,
      // and also the parent a newly created objective aligns beneath.
      return {
        upstream: workspace.candidates[0]?.node ?? null,
        team: null as GoalNodeDto | null,
      };
    }
    return null;
  }, [ownUnit, goals.data]);

  const teamId = resolved?.team?.id ?? null;
  const upstreamId = resolved?.upstream?.id ?? null;
  const teamProgress = useObjectiveProgress(cycle.id, teamId);
  const upstreamProgress = useObjectiveProgress(cycle.id, upstreamId);

  const [panelId, setPanelId] = useState<string | null>(null);
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const [recording, setRecording] = useState(false);

  // A leader without an organizational placement, or a scope with no published direction to inherit,
  // has no Team Direction to show — stay silent rather than render an empty scaffold.
  if (me.isLoading || goals.isLoading) return <SectionSkeleton />;
  if (!ownUnit || !resolved || !resolved.upstream) return null;

  const { upstream, team } = resolved;
  const goalsHref = team
    ? `/performance/goals?focus=${team.id}`
    : "/performance/goals";

  return (
    <section
      aria-labelledby="team-direction-heading"
      className="rounded-2xl border border-border bg-muted/20 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="team-direction-heading" className="type-page-title text-foreground">
            Team Direction
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your team&apos;s objective and its alignment to the broader
            organizational direction.
          </p>
        </div>
        {canViewOrgGoals ? (
          <Button variant="outline" asChild>
            <a href={goalsHref}>
              View in Organization Goals
              <ExternalLink
                className="size-4"
                data-icon="inline-end"
                aria-hidden
              />
            </a>
          </Button>
        ) : null}
      </div>

      <div className="mt-5 grid items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.1fr)]">
        <UpstreamCard
          node={upstream}
          progress={upstreamProgress.data ?? null}
          onInspect={setPanelId}
        />
        <SupportsConnector />
        {team ? (
          <TeamObjectiveCard
            unitName={ownUnit.name}
            node={team}
            progress={teamProgress.data ?? null}
            onInspect={setPanelId}
            onResumeDraft={() =>
              setComposer({ mode: "edit", objectiveId: team.id })
            }
            onDelete={async () => {
              try {
                await goalMutations.remove.mutateAsync(team.id);
                toast.success("Draft objective deleted.");
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Could not delete the objective."
                );
              }
            }}
            onRecord={() => setRecording(true)}
          />
        ) : (
          <TeamObjectiveEmptyCard
            onCreate={() =>
              setComposer({
                mode: "create",
                parentId: upstream.id,
                orgUnitId: ownUnit.orgUnitId,
              })
            }
          />
        )}
      </div>

      <ObjectiveContextPanel
        cycleId={cycle.id}
        objectiveId={panelId}
        open={panelId !== null}
        onOpenChange={(open) => {
          if (!open) setPanelId(null);
        }}
        // Team Performance has no in-place drill; following a related objective opens it in the
        // canonical Organization Goals surface where the full hierarchy lives.
        onFocus={(id) => {
          window.location.href = `/performance/goals?focus=${id}`;
        }}
        onEdit={(d) => {
          setPanelId(null);
          setComposer({ mode: "edit", objectiveId: d.node.id });
        }}
      />

      {composer ? (
        <OrgComposerHost
          cycle={cycle}
          state={composer}
          ownUnit={ownUnit}
          onClose={() => setComposer(null)}
        />
      ) : null}

      {recording && team ? (
        <TeamObjectiveRecordDrawer
          cycleId={cycle.id}
          objectiveId={team.id}
          title={team.title}
          open={recording}
          onOpenChange={setRecording}
        />
      ) : null}
    </section>
  );
}

// ── Upstream (inherited) direction — the quieter context card ─────────────────────

function UpstreamCard({
  node,
  progress,
  onInspect,
}: {
  node: GoalNodeDto;
  progress: ObjectiveProgressDto | null;
  onInspect: (id: string) => void;
}) {
  const kindLabel =
    node.ownershipScope === "Company"
      ? "Company strategic objective"
      : `${node.orgUnitName ?? "Organizational"} objective`;

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-5">
      {/* Top row: identity + status on the left, the objective's date far right. */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <IconTile icon={Waypoints} />
          <p className="type-eyebrow text-muted-foreground">
            Upstream objective
          </p>
          <StatusBadge tone={STATE_TONE[node.state]} dot>
            {STATE_LABEL[node.state]}
          </StatusBadge>
        </div>
        <ObjectiveDate node={node} progress={progress} />
      </div>

      {/* Title + scope, dropped below the identity row. */}
      <div className="mt-3">
        <button
          type="button"
          onClick={() => onInspect(node.id)}
          className="block rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <h3 className="text-lg font-semibold leading-snug tracking-tight text-foreground hover:underline">
            {node.title}
          </h3>
        </button>
        <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
          <Target className="size-3.5" aria-hidden />
          {kindLabel}
        </p>
      </div>

      {/* Inherited progress, full width beneath the scope line. */}
      <div className="mb-1.5 mt-4">
        <ProgressBar progress={progress} tone="muted" />
      </div>

      <div className="mt-auto flex flex-wrap items-start gap-x-8 gap-y-3 border-t border-border/60 pt-4">
        <AccountableFact name={node.accountablePersonName} />
        <MeasurementFact node={node} progress={progress} />
        <ViewDetailsLink
          className="ml-auto self-center"
          onClick={() => onInspect(node.id)}
        />
      </div>
    </div>
  );
}

// ── The manager's own objective — the focal card ──────────────────────────────────

/**
 * The scope's owned objective, rendered with clear ownership weight — a raised card, the accent icon
 * tile, an eyebrow that reads as "mine", and greater width in the row. Ownership is carried by
 * structure and the restrained Fusion accent, never a green "yours" outline: green stays reserved for
 * real status (a completed objective). Published planning shows definition only; once the objective
 * has real progress (or the actor may record it), the execution band appears.
 */
function TeamObjectiveCard({
  unitName,
  node,
  progress,
  onInspect,
  onResumeDraft,
  onDelete,
  onRecord,
}: {
  unitName: string;
  node: GoalNodeDto;
  progress: ObjectiveProgressDto | null;
  onInspect: (id: string) => void;
  onResumeDraft: () => void;
  onDelete: () => void | Promise<void>;
  onRecord: () => void;
}) {
  const isDraft = node.state === "Draft";
  // A draft with nothing aligned beneath it can be discarded outright.
  const canDelete = isDraft && node.childCount === 0;
  // Execution-aware: the band appears once there is progress to read, or the actor may record it.
  // Direct-measurement objectives expose the manual recorder; calculated ones roll up and never do.
  const canRecord =
    Boolean(progress?.canUpdate) && node.progressSource === "Direct";
  const showExecution = Boolean(
    progress && (progress.hasProgress || progress.canUpdate)
  );

  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-xl border border-primary bg-card p-5 shadow-raised"
    >
      {/* Top row: identity + status on the left, the objective's date far right. */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <IconTile icon={Users} accent />
          <p className="type-eyebrow text-primary">Your team objective</p>
          <StatusBadge tone={STATE_TONE[node.state]} dot>
            {STATE_LABEL[node.state]}
          </StatusBadge>
        </div>
        <ObjectiveDate node={node} progress={progress} />
      </div>

      {/* Title + scope, dropped below the identity row. */}
      <div className="mt-3">
        <button
          type="button"
          onClick={() => onInspect(node.id)}
          className="block rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <h3 className="text-xl font-semibold leading-snug tracking-tight text-foreground hover:underline">
            {node.title}
          </h3>
        </button>
        <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
          <Target className="size-3.5" aria-hidden />
          {node.orgUnitName ?? unitName}
        </p>
      </div>

      {/* Progress + meta anchored as one bottom group, so the gap from the progress block to the
          divider stays fixed regardless of the progress block's height (bar vs. empty state). */}
      <div className="mt-auto">
        {showExecution ? (
          <div className="mb-1.5 pt-4">
            <ProgressBar progress={progress} />
          </div>
        ) : null}

        <div className="flex flex-wrap items-start gap-x-8 gap-y-3 border-t border-border/60 pt-4">
          <AccountableFact name={node.accountablePersonName} />
          <MeasurementFact node={node} progress={progress} />
          <div className="ml-auto flex shrink-0 items-center gap-2 self-center">
          {isDraft ? (
            <>
              {canDelete ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => void onDelete()}
                >
                  <Trash2
                    className="size-3.5"
                    data-icon="inline-start"
                    aria-hidden
                  />{" "}
                  Delete
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={onResumeDraft}>
                <Pencil
                  className="size-3.5"
                  data-icon="inline-start"
                  aria-hidden
                />{" "}
                Resume editing
              </Button>
            </>
          ) : (
            <ViewDetailsLink onClick={() => onInspect(node.id)} />
          )}
          {canRecord ? (
            <Button size="sm" onClick={onRecord}>
              Update progress
            </Button>
          ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The owned empty state — the scope has inherited direction but established no objective yet. A
 * purposeful call to create the canonical organizational objective, aligned to the upstream direction,
 * launched through the shared composer. Its dashed accent frame marks it as an owned space awaiting
 * action; "Not set" is a presentational absence marker, not a fabricated lifecycle status.
 */
function TeamObjectiveEmptyCard({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border border-dashed border-primary/45 bg-primary/[0.03] p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <IconTile icon={Users} accent />
        <p className="type-eyebrow text-muted-foreground">
          Your team objective
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          {/* <CircleDashed className="size-3.5" aria-hidden /> */}○ Not set
        </span>
      </div>

      <div className="mt-5 flex flex-1 flex-col justify-center">
        <h3 className="text-2xl font-semibold tracking-tight text-foreground">
          No team objective yet
        </h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Create a team objective to align your team&apos;s work with this
          direction and drive measurable impact.
        </p>
        <div className="mt-5">
          <Button size="lg" onClick={onCreate}>
            <Plus className="size-4" data-icon="inline-start" aria-hidden />{" "}
            Create objective
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Shared pieces ─────────────────────────────────────────────────────────────────

/** The quiet, amber "View details →" affordance — the canonical objective panel opener. */
function ViewDetailsLink({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 pb-0.5 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      View details
      <ArrowRight className="size-3.5" aria-hidden />
    </button>
  );
}

/**
 * The objective's timestamp on the top row — the last progress update when execution is under way,
 * otherwise the published date. Omitted for a Draft or an objective with neither (never a placeholder).
 */
function ObjectiveDate({
  node,
  progress,
}: {
  node: GoalNodeDto;
  progress: ObjectiveProgressDto | null;
}) {
  const lastUpdate = progress?.hasProgress
    ? (progress.history[0]?.recordedAt ?? null)
    : null;
  const [label, iso] = lastUpdate
    ? (["Updated", lastUpdate] as const)
    : node.state === "Published" && node.publishedAt
      ? (["Published", node.publishedAt] as const)
      : // A Draft carries its last-saved date (last edit, else creation).
        (["Saved", node.updatedAt ?? node.createdAt] as const);
  if (!iso) return null;
  return (
    <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
      <span className="text-muted-foreground/70">{label}</span>{" "}
      {formatDate(iso.slice(0, 10))}
    </span>
  );
}

/** A rounded-square glyph tile — the card's identity mark, accent-filled for the owned objective. */
function IconTile({
  icon: Icon,
  accent,
}: {
  icon: typeof Users;
  accent?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg border",
        accent
          ? "border-primary/40 bg-primary/[0.12] text-primary"
          : "border-border bg-muted/60 text-muted-foreground"
      )}
    >
      <Icon className="size-5" />
    </span>
  );
}

/**
 * The relationship connector. On wide layouts it is a flowchart-style elbow — the alignment path exits
 * the upstream card low on the left, jogs up with rounded corners, and arrives at the team card with an
 * arrowhead, the "Supports" pill riding the path. On narrow (stacked) layouts it collapses to a short
 * vertical link between the two cards so the relationship survives stacking.
 */
function SupportsConnector() {
  return (
    <div
      className="relative flex items-center justify-center py-1 lg:h-28 lg:w-24 lg:self-center lg:py-0"
      aria-hidden
    >
      {/* Stacked (narrow): a plain vertical link behind the pill. */}
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border lg:hidden" />

      {/* Wide: a steep S that bleeds into the grid gaps so its tips meet both cards — an arrowhead
          points into the upstream direction, a dot anchors the team end. */}
      <svg
        viewBox="0 0 120 112"
        fill="none"
        preserveAspectRatio="none"
        className="absolute -inset-x-3 inset-y-0 hidden text-muted-foreground/45 lg:block"
      >
        {/* Mirrored horizontally so the arrowhead points into the upstream card — the team objective
            supports the upstream direction; a dot anchors the team end. */}
        <g transform="translate(120,0) scale(-1,1)">
          <path
            d="M4 88 H46 a14 14 0 0 0 14 -14 V38 a14 14 0 0 1 14 -14 H110"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="4" cy="88" r="3.5" className="fill-muted-foreground/70" />
          <path
            d="M108 17 L120 24 L108 31 Z"
            className="fill-muted-foreground/70"
          />
        </g>
      </svg>

      <span className="relative z-10 inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
        Supports
      </span>
    </div>
  );
}

/**
 * The objective's progress — a "Progress" label over a headline percent and a full-width bar. Shared by
 * both cards; `muted` quiets the fill for the upstream context, `accent` carries the owned objective.
 * Missing progress reads as a truthful 0% over an empty track, never a fabricated figure.
 */
function ProgressBar({
  progress,
  tone = "accent",
}: {
  progress: ObjectiveProgressDto | null;
  tone?: "muted" | "accent";
}) {
  const value = progress?.hasProgress ? Math.round(progress.derivedProgress) : 0;
  const clamped = Math.max(0, Math.min(100, value));
  const complete = value >= 100;
  return (
    <div>
      <p className="type-eyebrow text-muted-foreground">Progress</p>
      <div className="mt-1.5 flex items-center gap-3">
        <span
          className={cn(
            "text-lg font-semibold tabular-nums leading-none",
            complete
              ? "text-success"
              : tone === "muted"
                ? "text-muted-foreground"
                : "text-foreground"
          )}
        >
          {value}%
        </span>
        <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <span
            className={cn(
              "block h-full rounded-full",
              complete
                ? "bg-success"
                : tone === "muted"
                  ? "bg-muted-foreground/45"
                  : "bg-primary"
            )}
            style={{ width: `${clamped}%` }}
          />
        </span>
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="type-eyebrow text-muted-foreground/70">{label}</dt>
      <dd className="mt-1.5">{children}</dd>
    </div>
  );
}

function AccountableFact({ name }: { name: string | null }) {
  return (
    <Fact label="Accountable">
      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Avatar className="size-7">
          <AvatarFallback className="text-[10px]">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
        <span className="truncate">{name ?? "Unassigned"}</span>
      </span>
    </Fact>
  );
}

/**
 * The measurement facet — the method (with numeric direction) over the concrete measure. Prefers the
 * canonical progress DTO's structured fields (method, direction, baseline → target); falls back to the
 * node's summary string before the detail resolves. Numeric targets read as a labelled baseline →
 * target strip so the measure is legible at a glance, not a bare pair of numbers.
 */
function MeasurementFact({
  node,
  progress,
}: {
  node: GoalNodeDto;
  progress: ObjectiveProgressDto | null;
}) {
  const summary = node.measurementSummary?.trim();
  if (!progress && !summary) return null;

  if (progress) {
    const method = MEASUREMENT_METHOD_LABEL[progress.method];
    const Icon = node.progressSource === "Calculated" ? Layers : Gauge;

    if (progress.method === "NumericTarget") {
      return (
        <Fact label="Measurement">
          <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Icon className="size-3.5 text-muted-foreground" aria-hidden />
            <span className="tabular-nums">
              {formatMeasureValue(progress.baseline, progress.unit)} →{" "}
              {formatMeasureValue(progress.target, progress.unit)}
            </span>
            {progress.direction ? (
              <span className="font-normal text-muted-foreground">
                · {progress.direction}
              </span>
            ) : null}
          </span>
        </Fact>
      );
    }

    if (progress.method === "WeightedMilestones") {
      const count = progress.milestones.length;
      const done = progress.milestones.filter((m) => m.isCompleted).length;
      return (
        <Fact label="Measurement">
          <span className="flex items-center gap-1.5 text-sm font-medium leading-snug text-foreground">
            <Icon className="size-3.5 text-muted-foreground" aria-hidden />
            {method}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {done} of {count} milestone{count === 1 ? "" : "s"} complete
          </span>
        </Fact>
      );
    }

    return (
      <Fact label="Measurement">
        <span className="flex items-center gap-1.5 text-sm font-medium leading-snug text-foreground">
          <Icon className="size-3.5 text-muted-foreground" aria-hidden />
          {method}
        </span>
      </Fact>
    );
  }

  return (
    <Fact label="Measurement">
      <span className="text-sm font-medium tabular-nums text-foreground">
        {summary}
      </span>
    </Fact>
  );
}

function SectionSkeleton() {
  return (
    <section
      className="rounded-2xl border border-border bg-muted/20 p-5 sm:p-6"
      aria-hidden
    >
      <div className="h-6 w-40 animate-pulse rounded bg-muted" />
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      </div>
    </section>
  );
}
