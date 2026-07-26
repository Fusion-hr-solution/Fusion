"use client";

import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import {
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
  type AcknowledgeEvaluationRequest,
  type AssessmentObjectiveItemDto,
  type AssessmentSkillItemDto,
  type AssessmentWorkspaceDto,
} from "@repo/api";
import { useApiMutation } from "@repo/api/query";
import { Button, Textarea } from "@repo/ds";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/labels";
import { evaluationTerms } from "./evaluation-terms";

/**
 * Post-finalization result surface for the employee: a display-weight numeral
 * lead, the weight split carrying both area ratings, per-item you/manager
 * comparison rows, the discussion summary, and acknowledgement as a prominent
 * action band (never below the fold).
 */
export function ResultSurface({
  workspace,
  onAcknowledged,
}: {
  workspace: AssessmentWorkspaceDto;
  onAcknowledged: () => Promise<unknown>;
}) {
  const api = useMemo(() => createPlatformApiClient(), []);
  const result = workspace.result!;
  const [comment, setComment] = useState("");

  const acknowledge = useApiMutation<
    AssessmentWorkspaceDto,
    AcknowledgeEvaluationRequest
  >(
    (body) =>
      api.post(
        performancePaths.acknowledgeEvaluation(
          workspace.managerAssignmentId ?? workspace.assignmentId
        ),
        body,
        {
          headers: {
            "If-Match": `"${workspace.managerAssignmentVersion ?? 0}"`,
          },
        }
      ),
    {
      invalidateQueries: [
        { queryKey: performanceQueryKeys.myAssessments() },
        {
          queryKey: performanceQueryKeys.myAssessmentWorkspace(
            workspace.roundId
          ),
        },
      ],
      onSuccess: async () => {
        toast.success(evaluationTerms.acknowledge);
        await onAcknowledged();
      },
      onError: () => {
        toast.error("Could not record your acknowledgement.");
      },
    }
  );

  const objectivesWeight = result.objectivesWeightPercent;
  const skillsWeight = result.skillsWeightPercent;

  return (
    <div className="flex flex-col gap-8">
      {/* Result hero */}
      <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {evaluationTerms.finalResult}
            </p>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="text-6xl font-semibold leading-none tracking-tight tabular-nums">
                {result.finalScore?.toFixed(1) ?? "—"}
              </span>
              <span className="text-2xl font-medium text-muted-foreground">
                {result.finalRatingLabel ?? "—"}
              </span>
            </div>
          </div>
          {result.acknowledgedAt ? (
            <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 aria-hidden className="size-4" />
              {evaluationTerms.acknowledgedOn(formatDate(result.acknowledgedAt))}
            </span>
          ) : null}
        </div>

        <WeightSplitBar
          objectivesWeight={objectivesWeight}
          skillsWeight={skillsWeight}
          objectivesRating={result.overallObjectivesRatingLabel}
          objectivesOrdinal={result.overallObjectivesRatingOrdinal}
          skillsRating={result.overallSkillsRatingLabel}
          skillsOrdinal={result.overallSkillsRatingOrdinal}
        />
      </div>

      {/* Per-item comparison */}
      {workspace.objectives.length > 0 ? (
        <ComparisonRows
          title={evaluationTerms.objectivesArea}
          items={workspace.objectives.map((item) => ({
            id: item.objectiveSnapshotId,
            name: item.title,
            self: item.myRatingOrdinal,
            manager: item.managerRatingOrdinal,
            managerComment: item.managerComment,
          }))}
        />
      ) : null}
      {workspace.skills.length > 0 ? (
        <ComparisonRows
          title={evaluationTerms.skillsArea}
          items={workspace.skills.map((item) => ({
            id: item.skillSnapshotItemId,
            name: item.skillName,
            self: item.myProficiencyOrdinal,
            manager: item.managerProficiencyOrdinal,
            managerComment: item.managerComment,
          }))}
        />
      ) : null}

      {result.discussionSummary ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">
            {evaluationTerms.discussionSummary}
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {result.discussionSummary}
          </p>
        </section>
      ) : null}

      {/* Acknowledgement band */}
      {result.acknowledgedAt ? (
        result.acknowledgementComment ? (
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Your comment
            </p>
            <p className="mt-1 text-sm">{result.acknowledgementComment}</p>
          </div>
        ) : null
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <Textarea
            aria-label={evaluationTerms.acknowledge}
            placeholder={evaluationTerms.acknowledgementPlaceholder}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={2}
          />
          <Button
            className="self-start"
            disabled={acknowledge.isLoading}
            onClick={() =>
              acknowledge.mutate({ comment: comment.trim() || null })
            }
          >
            {evaluationTerms.acknowledge}
          </Button>
        </div>
      )}
    </div>
  );
}

function WeightSplitBar({
  objectivesWeight,
  skillsWeight,
  objectivesRating,
  objectivesOrdinal,
  skillsRating,
  skillsOrdinal,
}: {
  objectivesWeight: number;
  skillsWeight: number;
  objectivesRating: string | null;
  objectivesOrdinal: number | null;
  skillsRating: string | null;
  skillsOrdinal: number | null;
}) {
  const hasSkills = skillsWeight > 0;
  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-muted"
        aria-hidden
      >
        <div className="bg-primary" style={{ width: `${objectivesWeight}%` }} />
        <div
          className="bg-emerald-600 dark:bg-emerald-400"
          style={{ width: `${skillsWeight}%` }}
        />
      </div>
      <div
        className={cn(
          "grid gap-3",
          hasSkills ? "sm:grid-cols-2" : "sm:grid-cols-1"
        )}
      >
        <AreaTile
          accent="primary"
          area={evaluationTerms.objectivesArea}
          weight={objectivesWeight}
          ordinal={objectivesOrdinal}
          rating={objectivesRating}
        />
        {hasSkills ? (
          <AreaTile
            accent="emerald"
            area={evaluationTerms.skillsArea}
            weight={skillsWeight}
            ordinal={skillsOrdinal}
            rating={skillsRating}
          />
        ) : null}
      </div>
    </div>
  );
}

function AreaTile({
  accent,
  area,
  weight,
  ordinal,
  rating,
}: {
  accent: "primary" | "emerald";
  area: string;
  weight: number;
  ordinal: number | null;
  rating: string | null;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-xl border border-border p-3">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn(
            "size-2 rounded-full",
            accent === "primary" ? "bg-primary" : "bg-emerald-600 dark:bg-emerald-400"
          )}
        />
        <span className="text-sm font-medium">{area}</span>
        <span className="text-xs text-muted-foreground">{weight}%</span>
      </div>
      <div className="text-right">
        <span className="text-lg font-semibold tabular-nums">
          {ordinal ?? "—"}
        </span>
        <span className="ml-1.5 text-sm text-muted-foreground">
          {rating ?? "—"}
        </span>
      </div>
    </div>
  );
}

interface ComparisonRow {
  id: string;
  name: string;
  self: number | null;
  manager: number | null;
  managerComment: string | null;
}

function ComparisonRows({
  title,
  items,
}: {
  title: string;
  items: ComparisonRow[];
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {items.map((item) => {
          const delta =
            item.self != null && item.manager != null
              ? item.manager - item.self
              : null;
          return (
            <div
              key={item.id}
              className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{item.name}</p>
                {item.managerComment ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.managerComment}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-4 text-sm">
                <RatingChip label={evaluationTerms.yourRating} value={item.self} />
                <RatingChip
                  label={evaluationTerms.managerRating}
                  value={item.manager}
                  emphasis
                />
                {delta != null && delta !== 0 ? (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                      Math.abs(delta) >= 2
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {delta > 0 ? `+${delta}` : delta}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RatingChip({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: number | null;
  emphasis?: boolean;
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          emphasis ? "text-base font-semibold" : "font-medium"
        )}
      >
        {value ?? "—"}
      </span>
    </span>
  );
}

export type { AssessmentObjectiveItemDto, AssessmentSkillItemDto };
