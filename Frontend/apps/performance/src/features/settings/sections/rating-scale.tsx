"use client";

import { useCallback } from "react";
import { ApiError, type FusionSettingsSection, type RatingScaleLevelDto } from "@repo/api";
import { useSettingsConflictSaver } from "@repo/api/query";
import { useStagedSettings } from "@repo/api/react";
import { cn, Input } from "@repo/ds";
import { formatDate } from "@repo/ds/lib/dates";
import { PageError, SettingsBlock, SettingsPage, SettingsSaveBar, StatusBadge } from "@repo/ds/shell";
import { useRatingScale } from "@/features/performance/api/use-performance";
import { useSaveRatingScale } from "../api";

/** Levels on screen; descriptions are kept as text, empty meaning none. */
type Levels = RatingScaleLevelDto[];

function failure(error: unknown): string | null {
  if (!error) return null;
  return error instanceof ApiError && error.errors[0] ? error.errors[0] : "The rating scale didn't save. Try again.";
}

/** How a manager meets the scale: one rating per objective, the middle level chosen for the picture. */
function ScalePreview({ levels }: { levels: Levels }) {
  const middle = levels[Math.floor((levels.length - 1) / 2)]?.value;
  return (
    <div className="flex flex-col gap-3 rounded-surface border border-border bg-card p-5">
      <span className="flex flex-col gap-0.5">
        <span className="type-label font-semibold text-foreground">An objective in a review</span>
        <span className="type-meta text-muted-foreground">How a manager rates an objective</span>
      </span>
      <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(levels.length, 1)}, minmax(0, 1fr))` }}>
        {levels.map((level) => (
          <li
            key={level.value}
            title={level.description ?? undefined}
            className={cn(
              "flex min-h-16 flex-col gap-0.5 rounded-control border px-3 py-2",
              level.value === middle ? "border-primary bg-primary-tint" : "border-border bg-inlay"
            )}
          >
            <span className={cn("type-meta tabular-nums", level.value === middle ? "text-primary-ink" : "text-muted-foreground")}>
              {level.value}
            </span>
            <span className="text-sm font-semibold text-foreground">{level.label || "Unnamed"}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Settings › Rating scale: the levels reviewers rate with. Saving makes the next version; reviews already started
 * keep the version they began with.
 */
export function RatingScaleSettings({ section }: { section: FusionSettingsSection }) {
  const editable = section.access === "manage";
  const query = useRatingScale();
  const save = useSaveRatingScale();
  const saved = query.data?.levels;
  const version = query.data?.version ?? 0;
  const scaleVersion = query.data?.scaleVersion ?? 1;
  const { mutateAsync } = save;
  const persist = useCallback(
    (levels: Levels) =>
      mutateAsync({
        expectedVersion: version,
        levels: levels.map((level) => ({ ...level, label: level.label.trim(), description: level.description?.trim() || null })),
      }),
    [mutateAsync, version]
  );
  const staged = useStagedSettings(saved, persist, {
    onReload: () => void query.refetch(),
    leaveMessage: "Leave without saving? Your changes to the rating scale are discarded.",
  });
  const saver = useSettingsConflictSaver("performance", [section.id], staged.conflict);
  const levels = staged.draft;

  if (query.error && !query.data) {
    return (
      <SettingsPage title={section.label}>
        <PageError title="The rating scale didn't load" onRetry={() => void query.refetch()} />
      </SettingsPage>
    );
  }

  const setLevel = (value: number, change: Partial<RatingScaleLevelDto>) =>
    staged.update((current) => current.map((level) => (level.value === value ? { ...level, ...change } : level)));

  return (
    <SettingsPage title={section.label} lastChange={section.lastChange} setUpAt={section.setUpAt} viewOnly={!editable} loading={!levels}>
      {levels ? (
        <>
          <SettingsBlock title="Levels" meta={levels.length}>
            <ol className="divide-y divide-border overflow-hidden rounded-surface border border-border bg-card">
              {levels.map((level) => (
                <li key={level.value} className="flex items-center gap-3 px-5 py-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-control border border-border bg-inlay text-sm font-semibold tabular-nums">
                    {level.value}
                  </span>
                  {editable ? (
                    <>
                      <Input
                        aria-label={`Level ${level.value} name`}
                        value={level.label}
                        onChange={(event) => setLevel(level.value, { label: event.target.value })}
                        className="h-9 w-48 shrink-0 font-semibold"
                      />
                      <Input
                        aria-label={`Level ${level.value} description`}
                        placeholder="Add a description"
                        value={level.description ?? ""}
                        onChange={(event) => setLevel(level.value, { description: event.target.value })}
                        className="h-9 min-w-0 flex-1"
                      />
                    </>
                  ) : (
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="type-label font-semibold text-foreground">{level.label}</span>
                      {level.description ? <span className="type-meta text-muted-foreground">{level.description}</span> : null}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </SettingsBlock>

          <SettingsBlock title="In a review">
            <ScalePreview levels={levels} />
          </SettingsBlock>

          <SettingsBlock title="Versions">
            <div className="flex items-center gap-3 rounded-surface border border-border bg-card px-5 py-4">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-2 type-label font-semibold text-foreground">
                  Version {scaleVersion}
                  <StatusBadge tone="success" dot>
                    Current
                  </StatusBadge>
                </span>
                {section.lastChange || section.setUpAt ? (
                  <span className="type-meta text-muted-foreground">
                    Since {formatDate(section.lastChange?.at ?? section.setUpAt, { year: "always" })}
                  </span>
                ) : null}
              </span>
            </div>
          </SettingsBlock>

          {editable && saved ? (
            <SettingsSaveBar
              changes={staged.changes}
              consequence={`Saves as version ${scaleVersion + 1}. Reviews already started keep the version they began with.`}
              saveLabel={`Save version ${scaleVersion + 1}`}
              saving={staged.saving}
              error={failure(staged.error)}
              conflict={saver}
              conflictPending={staged.conflict && !saver}
              onDiscard={staged.discard}
              onSave={() => void staged.submit()}
              onReload={staged.reload}
            />
          ) : null}
        </>
      ) : null}
    </SettingsPage>
  );
}
