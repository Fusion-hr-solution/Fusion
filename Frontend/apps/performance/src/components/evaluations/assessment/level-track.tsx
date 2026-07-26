"use client";

import { cn } from "@/lib/utils";

export interface TrackLevel {
  ordinal: number;
  label: string;
  description?: string | null;
}

/**
 * The proficiency signature shape: one horizontal track per skill carrying the
 * expected level and each rater's assessment as positioned markers. In
 * interactive mode the track itself is the input — the current rater picks a
 * level directly on it (radio semantics, keyboard operable). The span between
 * expected and assessed is tinted by gap direction.
 */
export function LevelTrack({
  levels,
  expected,
  self,
  manager,
  value,
  onChange,
  disabled = false,
  ariaLabel,
  className,
}: {
  levels: TrackLevel[];
  expected: number | null;
  self?: number | null;
  manager?: number | null;
  /** Interactive selection (the current rater's value); rendered as the primary marker. */
  value?: number | null;
  onChange?: (ordinal: number) => void;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
}) {
  const n = levels.length;
  if (n === 0) return null;
  const interactive = !disabled && !!onChange;
  const position = (ordinal: number) =>
    n > 1 ? ((ordinal - 1) / (n - 1)) * 100 : 50;

  // Gap tint: assessed (interactive value, else manager) versus expected.
  const assessed = value ?? manager ?? null;
  const gap = assessed != null && expected != null ? assessed - expected : null;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="relative h-9">
        <div className="absolute inset-x-3 inset-y-0">
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted" />
          {gap != null && gap !== 0 ? (
            <div
              aria-hidden
              className={cn(
                "absolute top-1/2 h-1 -translate-y-1/2 rounded-full",
                gap < 0
                  ? "bg-amber-500/70 dark:bg-amber-400/60"
                  : "bg-emerald-500/70 dark:bg-emerald-400/60"
              )}
              style={{
                left: `${position(Math.min(assessed!, expected!))}%`,
                width: `${
                  position(Math.max(assessed!, expected!)) -
                  position(Math.min(assessed!, expected!))
                }%`,
              }}
            />
          ) : null}

          <div
            role={interactive ? "radiogroup" : undefined}
            aria-label={ariaLabel}
            className="absolute inset-0"
          >
            {levels.map((level) => {
              const isExpected = level.ordinal === expected;
              const isSelf = level.ordinal === self;
              const isManager = level.ordinal === manager;
              const isValue = level.ordinal === value;
              const stopProps = interactive
                ? ({
                    type: "button",
                    role: "radio",
                    "aria-checked": isValue,
                    onClick: () => onChange?.(level.ordinal),
                  } as const)
                : {};
              const Stop = interactive ? "button" : "span";
              return (
                <Stop
                  key={level.ordinal}
                  {...stopProps}
                  title={`${level.ordinal} · ${level.label}`}
                  className={cn(
                    "absolute top-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    interactive && "transition-transform hover:scale-110"
                  )}
                  style={{ left: `${position(level.ordinal)}%` }}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "rounded-full border-2 transition-all",
                      isValue
                        ? "size-4 border-primary bg-primary"
                        : isManager
                          ? "size-3.5 border-emerald-600 bg-emerald-600 dark:border-emerald-400 dark:bg-emerald-400"
                          : isSelf
                            ? "size-3.5 border-sky-600 bg-sky-600 dark:border-sky-400 dark:bg-sky-400"
                            : isExpected
                              ? "size-3.5 rotate-45 rounded-[3px] border-amber-600 bg-background dark:border-amber-400"
                              : "size-2 border-border bg-background"
                    )}
                  />
                  <span className="sr-only">{`${level.ordinal} · ${level.label}`}</span>
                </Stop>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex justify-between px-1.5 text-[11px] tabular-nums text-muted-foreground">
        {levels.map((level) => (
          <span key={level.ordinal}>{level.ordinal}</span>
        ))}
      </div>
    </div>
  );
}

/** Legend chips for the track markers actually in play on a surface. */
export function LevelTrackLegend({
  expected = true,
  selfLabel,
  managerLabel,
  className,
}: {
  expected?: boolean;
  selfLabel?: string | null;
  managerLabel?: string | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium text-muted-foreground",
        className
      )}
    >
      {expected ? (
        <span className="flex items-center gap-1">
          <span
            aria-hidden
            className="size-2 rotate-45 rounded-[2px] border-2 border-amber-600 dark:border-amber-400"
          />
          Expected
        </span>
      ) : null}
      {selfLabel ? (
        <span className="flex items-center gap-1">
          <span aria-hidden className="size-2 rounded-full bg-sky-600 dark:bg-sky-400" />
          {selfLabel}
        </span>
      ) : null}
      {managerLabel ? (
        <span className="flex items-center gap-1">
          <span
            aria-hidden
            className="size-2 rounded-full bg-emerald-600 dark:bg-emerald-400"
          />
          {managerLabel}
        </span>
      ) : null}
    </div>
  );
}
