"use client";

import type { OverviewYearDto } from "@repo/api";
import { cn } from "@repo/ds/lib/utils";
import { dayRange, yearHeadline } from "./overview-model";
import { useTranslations } from "next-intl";
import { useFormat } from "@repo/ds/lib/use-format";
import { useSay } from "@repo/ds/lib/say";

const DAY_MS = 86_400_000;
const MIN_SHARE = 0.1;

function at(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y!, (m ?? 1) - 1, d ?? 1) / DAY_MS;
}

/**
 * Where the year stands (performance-overview): the phases sized by their dates (a short phase keeps a readable
 * minimum), the elapsed part filled, today marked, the dates that concern the viewer as diamonds, and the current
 * phase with its days left and the next date in words. Overview's alone; the home never shows it (S-14).
 */
export function YearBand({ year, cycleName }: { year: OverviewYearDto; cycleName: string }) {
  const format = useFormat();
  const tr = useTranslations("overview.YearBand");
  const model = useSay("overview.model");
  const { phase, left, next } = yearHeadline(year, cycleName, model, format.locale);
  const spans = year.phases.map((p) => Math.max(1, at(p.end) - at(p.start) + 1));
  const total = spans.reduce((sum, s) => sum + s, 0);
  const raw = spans.map((s) => s / total);
  const floored = raw.map((share) => Math.max(share, MIN_SHARE));
  const scale = floored.reduce((sum, s) => sum + s, 0);
  const shares = floored.map((share) => share / scale);

  // Position of a date on the track, through the phase it falls in, so markers line up with the sized segments.
  const position = (iso: string) => {
    const t = at(iso);
    let offset = 0;
    for (let i = 0; i < year.phases.length; i += 1) {
      const p = year.phases[i]!;
      if (t <= at(p.end) || i === year.phases.length - 1) {
        const within = Math.min(1, Math.max(0, (t - at(p.start) + 0.5) / spans[i]!));
        return offset + within * shares[i]!;
      }
      offset += shares[i]!;
    }
    return 1;
  };
  const showToday = year.state === "Active";
  const today = position(year.today);
  const markers = year.dates.filter((d) => d.kind !== "cycle-end" && at(d.date) >= at(year.start) && at(d.date) <= at(year.end));

  return (
    <section aria-label={tr("yourYear")} className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="type-section-title text-foreground">{phase}</h2>
        {left ? <span className="type-section-title tabular-nums text-primary">{left}</span> : null}
        {next ? <p className="ms-auto type-body-secondary text-muted-foreground">{next}</p> : null}
      </div>
      <div className="relative pt-6">
        <div className="flex h-3 gap-[3px]" aria-hidden>
          {year.phases.map((p, i) => {
            const start = shares.slice(0, i).reduce((sum, s) => sum + s, 0);
            const filled = year.state === "Closed" || p.state === "Done" ? 1 : p.state === "Current" ? Math.min(1, Math.max(0, (today - start) / shares[i]!)) : 0;
            return (
              <span
                key={p.name}
                style={{ width: `${shares[i]! * 100}%` }}
                className={cn(
                  "relative overflow-hidden rounded-full",
                  year.state === "Draft" ? "ring-1 ring-inset ring-border" : "bg-inlay ring-1 ring-inset ring-border",
                )}
              >
                {filled > 0 ? (
                  <span
                    className={cn("absolute inset-y-0 inset-s-0", p.state === "Current" ? "bg-primary" : "bg-primary/60")}
                    style={{ width: `${filled * 100}%` }}
                  />
                ) : null}
              </span>
            );
          })}
        </div>
        {markers.map((d) => (
          <span
            key={`${d.kind}-${d.date}`}
            title={d.kind}
            aria-hidden
            className={cn(
              "absolute top-[25px] size-2.5 -translate-x-1/2 rotate-45 rounded-detail ring-2",
              at(d.date) >= at(year.today) ? "bg-primary ring-primary" : "bg-background ring-muted-foreground",
            )}
            style={{ left: `${position(d.date) * 100}%` }}
          />
        ))}
        {showToday ? (
          <span className="absolute top-0 h-10 w-0.5 rounded-full bg-foreground" style={{ left: `${today * 100}%` }} aria-hidden>
            <span className={cn("absolute top-[-2px] whitespace-nowrap type-meta-strong text-foreground", today > 0.9 ? "inset-e-2" : "inset-s-2")}>
              {tr("today")}
            </span>
          </span>
        ) : null}
        <div className="mt-3 flex gap-[3px]">
          {year.phases.map((p, i) => (
            <div key={p.name} style={{ width: `${shares[i]! * 100}%` }} className="min-w-0">
              <p className={cn("truncate type-label", p.state === "Current" ? "text-foreground" : "text-foreground/80")}>{model(`phase.${p.name}`)}</p>
              <p className="truncate type-meta text-muted-foreground">{dayRange(p.start, p.end, format.locale)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
