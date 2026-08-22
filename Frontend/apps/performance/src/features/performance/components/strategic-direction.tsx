"use client";

import { useState } from "react";
import { Gauge, MoreHorizontal, Plus, Send, Target, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import type { CycleSummaryDto, StrategicObjectiveDto } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ds/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@repo/ds/components/ui/empty";
import { StatusBadge } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { useSaveStrategy } from "../api/use-performance";
import { formatDateRange, measurementSummary } from "../lib";
import { ObjectiveEditor, type ObjectiveDraft } from "./objective-editor";

export function StrategicDirection({
  cycle,
  objectives,
  canPublish,
  readOnly,
}: {
  cycle: CycleSummaryDto;
  objectives: StrategicObjectiveDto[];
  canPublish: boolean;
  readOnly?: boolean;
}) {
  const { create, update, publish, remove } = useSaveStrategy(cycle.id);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<StrategicObjectiveDto | undefined>();

  const published = objectives.filter((objective) => objective.state === "Published");
  const drafts = objectives.filter((objective) => objective.state !== "Published");

  async function handleSubmit(draft: ObjectiveDraft) {
    if (editing) {
      await update.mutateAsync({
        objectiveId: editing.id,
        request: {
          title: draft.title,
          description: draft.description || null,
          accountablePersonId: draft.accountablePersonId,
          startDate: draft.startDate,
          endDate: draft.endDate,
          measurement: draft.measurement,
        },
      });
      toast.success("Objective updated.");
    } else {
      await create.mutateAsync({
        title: draft.title,
        description: draft.description || null,
        accountablePersonId: draft.accountablePersonId,
        startDate: draft.startDate,
        endDate: draft.endDate,
        measurement: draft.measurement,
      });
      toast.success("Objective added to direction.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Strategic direction</h2>
          <p className="text-sm text-muted-foreground">
            The company outcomes this Cycle commits to. Published objectives become the alignment baseline.
          </p>
        </div>
        {canPublish && !readOnly ? (
          <Button
            onClick={() => {
              setEditing(undefined);
              setEditorOpen(true);
            }}
          >
            <Plus className="size-4" data-icon="inline-start" /> Add objective
          </Button>
        ) : null}
      </div>

      {objectives.length === 0 ? (
        <Empty className="rounded-2xl border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Target /></EmptyMedia>
            <EmptyTitle>No direction set yet</EmptyTitle>
            <EmptyDescription>
              Strategic objectives describe where the company is going this Cycle. Publish at least one to open planning.
            </EmptyDescription>
          </EmptyHeader>
          {canPublish && !readOnly ? (
            <EmptyContent>
              <Button
                onClick={() => {
                  setEditing(undefined);
                  setEditorOpen(true);
                }}
              >
                <Plus className="size-4" data-icon="inline-start" /> Add the first objective
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      ) : (
        <div className="space-y-6">
          {drafts.length > 0 ? (
            <section className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Draft — not yet cascading</p>
              <div className="grid gap-3">
                {drafts.map((objective) => (
                  <ObjectiveCard
                    key={objective.id}
                    objective={objective}
                    canPublish={canPublish && !readOnly}
                    onEdit={() => {
                      setEditing(objective);
                      setEditorOpen(true);
                    }}
                    onPublish={async () => {
                      try {
                        await publish.mutateAsync(objective.id);
                        toast.success(`“${objective.title}” is now published.`);
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Could not publish.");
                      }
                    }}
                    onDelete={async () => {
                      try {
                        await remove.mutateAsync(objective.id);
                        toast.success("Draft objective removed.");
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Could not remove.");
                      }
                    }}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {published.length > 0 ? (
            <section className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Published direction</p>
              <div className="grid gap-3">
                {published.map((objective) => (
                  <ObjectiveCard key={objective.id} objective={objective} canPublish={false} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      <ObjectiveEditor open={editorOpen} onOpenChange={setEditorOpen} cycle={cycle} objective={editing} onSubmit={handleSubmit} />
    </div>
  );
}

function ObjectiveCard({
  objective,
  canPublish,
  onEdit,
  onPublish,
  onDelete,
}: {
  objective: StrategicObjectiveDto;
  canPublish: boolean;
  onEdit?: () => void;
  onPublish?: () => void;
  onDelete?: () => void;
}) {
  const isPublished = objective.state === "Published";
  return (
    <article
      className={cn(
        "group relative rounded-2xl border p-5 transition-colors",
        isPublished ? "border-border bg-card" : "border-primary/30 bg-primary/[0.03]"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h3 className="text-base font-semibold tracking-tight">{objective.title}</h3>
          {objective.description ? (
            <p className="max-w-prose text-sm text-muted-foreground">{objective.description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge tone={isPublished ? "success" : "info"} dot>
            {isPublished ? "Published" : "Draft"}
          </StatusBadge>
          {canPublish ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Objective actions">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem>
                <DropdownMenuItem onSelect={onDelete} variant="destructive">
                  <Trash2 className="size-3.5" /> Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-1.5">
          <UserRound className="size-3.5 text-muted-foreground" aria-hidden />
          <dt className="sr-only">Accountable</dt>
          <dd>{objective.accountablePersonName ?? "Accountable person"}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <Gauge className="size-3.5 text-muted-foreground" aria-hidden />
          <dt className="sr-only">Measurement</dt>
          <dd className="text-muted-foreground">{measurementSummary(objective.measurement)}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Period</dt>
          <dd className="text-muted-foreground">{formatDateRange(objective.startDate, objective.endDate)}</dd>
        </div>
      </dl>

      {canPublish && !isPublished ? (
        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={onPublish}>
            <Send className="size-3.5" data-icon="inline-start" /> Publish
          </Button>
        </div>
      ) : null}
    </article>
  );
}
