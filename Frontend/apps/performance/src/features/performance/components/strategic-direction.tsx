"use client";

import { useState } from "react";
import { CalendarRange, Gauge, MoreHorizontal, Pencil, Plus, Send, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import type { CycleSummaryDto, StrategicObjectiveDto } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ds/components/ui/dropdown-menu";
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
  const canAuthor = canPublish && !readOnly;

  function openNew() {
    setEditing(undefined);
    setEditorOpen(true);
  }

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
        <h2 className="type-section-title text-foreground">Strategic direction</h2>
        {canAuthor && objectives.length > 0 ? (
          <Button onClick={openNew}>
            <Plus className="size-4" data-icon="inline-start" /> Add objective
          </Button>
        ) : null}
      </div>

      {objectives.length === 0 ? (
        <div className="max-w-lg space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Strategic objectives are the company outcomes this Cycle commits to. Publish at least
            one to open alignment and planning.
          </p>
          {canAuthor ? (
            <Button onClick={openNew}>
              <Plus className="size-4" data-icon="inline-start" /> Add the first objective
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-7">
          {drafts.length > 0 ? (
            <section className="space-y-3">
              <p className="type-eyebrow text-muted-foreground">In draft · not yet cascading</p>
              <div className="space-y-3">
                {drafts.map((objective) => (
                  <ObjectiveCard
                    key={objective.id}
                    objective={objective}
                    canAuthor={canAuthor}
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
              <p className="type-eyebrow text-muted-foreground">Published direction</p>
              <div className="space-y-3">
                {published.map((objective) => (
                  <ObjectiveCard key={objective.id} objective={objective} canAuthor={false} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      <ObjectiveEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        cycle={cycle}
        objective={editing}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

function ObjectiveCard({
  objective,
  canAuthor,
  onEdit,
  onPublish,
  onDelete,
}: {
  objective: StrategicObjectiveDto;
  canAuthor: boolean;
  onEdit?: () => void;
  onPublish?: () => void;
  onDelete?: () => void;
}) {
  const isDraft = objective.state !== "Published";

  return (
    <article
      className={cn(
        "rounded-2xl border p-5",
        isDraft
          ? "border-dashed border-primary/40 bg-primary/[0.02]"
          : "border-primary/25 bg-primary/[0.04]"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="type-panel-title text-foreground">{objective.title}</h3>
            {isDraft ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-dotted border-primary/50 bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                Draft
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                Published
              </span>
            )}
          </div>
          {objective.description ? (
            <p className="max-w-prose text-sm text-muted-foreground">{objective.description}</p>
          ) : null}
        </div>
        {canAuthor ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Objective actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil className="size-3.5" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onDelete} variant="destructive">
                <Trash2 className="size-3.5" /> Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <UserRound className="size-3.5 text-primary/70" aria-hidden />
            <span className="font-medium text-foreground">
              {objective.accountablePersonName ?? "Unassigned"}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Gauge className="size-3.5 text-primary/70" aria-hidden />
            <span className="tabular-nums text-foreground">
              {measurementSummary(objective.measurement)}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <CalendarRange className="size-3.5 text-primary/70" aria-hidden />
            {formatDateRange(objective.startDate, objective.endDate)}
          </span>
        </div>
        {canAuthor && isDraft ? (
          <Button size="sm" onClick={onPublish}>
            <Send className="size-3.5" data-icon="inline-start" /> Publish
          </Button>
        ) : null}
      </div>
    </article>
  );
}
