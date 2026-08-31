"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Gauge,
  Layers,
  Lock,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { GoalDetailDto } from "@repo/api";
import { Avatar, AvatarFallback } from "@repo/ds/components/ui/avatar";
import { Button } from "@repo/ds/components/ui/button";
import { Input } from "@repo/ds/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@repo/ds/components/ui/sheet";
import { AsyncButton, StatusBadge } from "@repo/ds/shell";
import { Skeleton } from "@repo/ds/components/ui/skeleton";
import { cn } from "@repo/ds/lib/utils";
import { useGoal, useGoalMutations } from "../../api/use-performance";
import { formatDateRange, measurementSummary } from "../../lib";
import { initials, scopeLabel, STATE_LABEL, STATE_TONE } from "./goals-lib";

export function ObjectiveContextPanel({
  cycleId,
  objectiveId,
  open,
  onOpenChange,
  onFocus,
  onEdit,
}: {
  cycleId: string;
  objectiveId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFocus: (id: string) => void;
  onEdit: (detail: GoalDetailDto) => void;
}) {
  const detail = useGoal(cycleId, open ? objectiveId : null);
  const mutations = useGoalMutations(cycleId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg">
        {detail.isLoading || !detail.data ? (
          <>
            <SheetHeader className="sr-only">
              <SheetTitle>Objective</SheetTitle>
              <SheetDescription>Loading objective detail</SheetDescription>
            </SheetHeader>
            <div className="space-y-4 p-6">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
          </>
        ) : (
          <PanelBody
            detail={detail.data}
            mutations={mutations}
            onFocus={(id) => {
              onFocus(id);
            }}
            onEdit={() => onEdit(detail.data!)}
            onClose={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function PanelBody({
  detail,
  mutations,
  onFocus,
  onEdit,
  onClose,
}: {
  detail: GoalDetailDto;
  mutations: ReturnType<typeof useGoalMutations>;
  onFocus: (id: string) => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  const { node, parent } = detail;
  const isOrg = node.ownershipScope === "OrgUnit";

  return (
    <>
      <SheetHeader className="border-b p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-muted-foreground">{scopeLabel(node)}</span>
          <StatusBadge tone={STATE_TONE[node.state]} dot>{STATE_LABEL[node.state]}</StatusBadge>
        </div>
        <SheetTitle className="text-lg leading-snug">{node.title}</SheetTitle>
        <SheetDescription className="sr-only">Objective detail and decision</SheetDescription>
        {parent ? (
          <button
            type="button"
            onClick={() => onFocus(parent.id)}
            className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowUpRight className="size-3.5 text-primary" aria-hidden /> Supports {parent.title}
          </button>
        ) : null}
      </SheetHeader>

      <div className="flex-1 space-y-6 p-6">
        {detail.description ? <p className="text-sm leading-relaxed text-muted-foreground">{detail.description}</p> : null}

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border">
          <Field label="Accountable">
            <span className="flex items-center gap-2">
              <Avatar className="size-5"><AvatarFallback className="text-[9px]">{initials(detail.accountable.name)}</AvatarFallback></Avatar>
              {detail.accountable.name ?? "—"}
            </span>
          </Field>
          <Field label="Period">{formatDateRange(node.startDate, node.endDate)}</Field>
          <Field label="Progress source" className="col-span-2">
            <span className="flex items-center gap-1.5">
              {node.progressSource === "Calculated" ? <Layers className="size-3.5 text-primary" aria-hidden /> : <Gauge className="size-3.5 text-primary" aria-hidden />}
              {detail.measurement ? measurementSummary(detail.measurement) : node.measurementSummary}
            </span>
          </Field>
        </dl>

        {/* Contribution — calculated objectives only. */}
        {node.progressSource === "Calculated" ? (
          <ContributionSection detail={detail} mutations={mutations} />
        ) : null}

        {/* Aligned children */}
        {detail.children.length > 0 ? (
          <section className="space-y-2">
            <SectionLabel>Aligned objectives · {detail.children.length}</SectionLabel>
            <div className="divide-y overflow-hidden rounded-2xl border">
              {detail.children.map((child) => (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => onFocus(child.id)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{child.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{scopeLabel(child)} · {child.accountablePersonName ?? "—"}</p>
                  </div>
                  <StatusBadge tone={STATE_TONE[child.state]}>{STATE_LABEL[child.state]}</StatusBadge>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </button>
              ))}
            </div>
          </section>
        ) : null}

      </div>

      {/* Owner actions */}
      {isOrg && (detail.canEdit || detail.canPublish) ? (
        <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t bg-background p-4">
          <div className="flex gap-2">
            {detail.canEdit ? (
              <Button variant="outline" size="sm" onClick={onEdit}>Edit</Button>
            ) : null}
            {detail.canEdit && node.childCount === 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  try {
                    await mutations.remove.mutateAsync(node.id);
                    toast.success("Objective removed.");
                    onClose();
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not remove.");
                  }
                }}
              >
                <Trash2 className="size-3.5" data-icon="inline-start" /> Remove
              </Button>
            ) : null}
          </div>
          {detail.canPublish ? (
            <AsyncButton
              size="sm"
              pending={mutations.publish.isLoading}
              onClick={async () => {
                try {
                  await mutations.publish.mutateAsync(node.id);
                  toast.success("Published as organizational direction.");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not publish.");
                }
              }}
            >
              Publish
            </AsyncButton>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function ContributionSection({
  detail,
  mutations,
}: {
  detail: GoalDetailDto;
  mutations: ReturnType<typeof useGoalMutations>;
}) {
  const { node } = detail;
  const locked = node.isContributionBaselineLocked;
  const configuredById = useMemo(
    () => new Map(detail.contribution.map((link) => [link.childObjectiveId, link.weight])),
    [detail.contribution]
  );
  const [weights, setWeights] = useState<Record<string, string>>({});

  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const child of detail.children) {
      const weight = configuredById.get(child.id);
      initial[child.id] = weight != null ? String(weight) : "";
    }
    setWeights(initial);
  }, [detail.children, configuredById]);

  const total = Object.values(weights).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const contributors = detail.children.filter((child) => Number(weights[child.id]) > 0);
  const allChildrenPublished = contributors.length > 0 && contributors.every((child) => child.state === "Published");

  if (locked) {
    return (
      <section className="space-y-3">
        <SectionLabel>
          <span className="inline-flex items-center gap-1.5"><Lock className="size-3.5" aria-hidden /> Contribution baseline</span>
        </SectionLabel>
        <div className="space-y-1.5 rounded-2xl border border-success/30 bg-success-subtle p-4">
          {detail.contribution.map((link) => (
            <div key={link.childObjectiveId} className="flex items-center justify-between text-sm">
              <span className="truncate">{link.childTitle}</span>
              <span className="font-medium tabular-nums">{link.weight}%</span>
            </div>
          ))}
          <div className="mt-2 flex items-center justify-between border-t border-success/20 pt-2 text-sm font-semibold">
            <span className="inline-flex items-center gap-1.5 text-success"><Check className="size-4" aria-hidden /> Baseline locked</span>
            <span className="tabular-nums">100%</span>
          </div>
        </div>
      </section>
    );
  }

  if (detail.children.length === 0) {
    return (
      <section className="space-y-2">
        <SectionLabel>Contribution baseline</SectionLabel>
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Create the contributing objectives beneath this one, then set how much each contributes.
        </p>
      </section>
    );
  }

  const canEdit = detail.canConfigureContribution;

  return (
    <section className="space-y-3">
      <SectionLabel>Contribution baseline</SectionLabel>
      <div className="space-y-3 rounded-2xl border p-4">
        <p className="text-xs text-muted-foreground">
          Set how much each aligned objective contributes. Aligned objectives with no weight support the direction but do not roll up.
        </p>
        {detail.children.map((child) => (
          <div key={child.id} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{child.title}</p>
              <p className="truncate text-xs text-muted-foreground">{scopeLabel(child)}</p>
            </div>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                inputMode="numeric"
                value={weights[child.id] ?? ""}
                disabled={!canEdit}
                onChange={(event) => setWeights((prev) => ({ ...prev, [child.id]: event.target.value }))}
                className="w-20 text-right"
                placeholder="0"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        ))}

        {/* Live weight summary */}
        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-sm text-muted-foreground">
            {total === 100 ? "Fully allocated" : total < 100 ? `${100 - total}% remains to assign` : `${total - 100}% over`}
          </span>
          <span className={cn("text-lg font-semibold tabular-nums", total === 100 ? "text-success" : "text-warning")}>{total}%</span>
        </div>

        {canEdit ? (
          <div className="flex items-center justify-end gap-2">
            <AsyncButton
              size="sm"
              variant="outline"
              pending={mutations.configureContribution.isLoading}
              onClick={async () => {
                try {
                  await mutations.configureContribution.mutateAsync({
                    objectiveId: node.id,
                    request: { contributors: contributors.map((child) => ({ childObjectiveId: child.id, weight: Number(weights[child.id]) })) },
                  });
                  toast.success("Contribution saved.");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not save.");
                }
              }}
            >
              Save
            </AsyncButton>
            <AsyncButton
              size="sm"
              pending={mutations.lockContribution.isLoading}
              disabled={total !== 100 || !allChildrenPublished}
              onClick={async () => {
                try {
                  await mutations.lockContribution.mutateAsync(node.id);
                  toast.success("Contribution baseline locked.");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Could not lock.");
                }
              }}
            >
              <Lock className="size-3.5" data-icon="inline-start" /> Lock baseline
            </AsyncButton>
          </div>
        ) : null}
        {canEdit && total === 100 && !allChildrenPublished ? (
          <p className="text-xs text-muted-foreground">Every contributing objective must be published before the baseline can lock.</p>
        ) : null}
      </div>
    </section>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-card p-3", className)}>
      <dt className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{children}</dd>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="type-eyebrow text-muted-foreground">{children}</p>;
}
