import type {
  CalibrationFilter,
  CalibrationFlagDto,
  RatingScaleLevelDto,
  ReviewPotential,
} from "@repo/api";
import type { CalibrationView } from "../../api/use-calibration";
import { english, type Say } from "@/i18n/say";

export const POTENTIALS: readonly ReviewPotential[] = ["Developing", "Growing", "High"];

/** A flag's facts in words (D-25). The disagreement flag fires only in the top or bottom band, so its attainment says which. */
const en = english("calibration.format");

export function flagText(flag: CalibrationFlagDto, say: Say = en): string {
  if (flag.kind === "MovedSinceLastCycle") {
    const count = Math.abs(flag.moved ?? 0);
    const up = (flag.moved ?? 0) > 0;
    return flag.cycle ? say(up ? "upSince" : "downSince", { count, cycle: flag.cycle }) : say(up ? "up" : "down", { count });
  }
  const share = Math.round(flag.attainment ?? 0);
  return say(share < 50 ? "top" : "bottom", { share });
}

/** A reviewer's distance from the session average, as the leniency flag says it. */
export function leniencyText(delta: number, say: Say = en): string {
  return say(delta >= 0 ? "above" : "below", { delta: Math.abs(delta).toFixed(1) });
}

export function average(value: number): string {
  return value.toFixed(1);
}

export function signed(value: number): string {
  return value === 0 ? "±0" : value > 0 ? `+${value}` : `−${Math.abs(value)}`;
}

/** The levels each nine-box band holds on this scale: low ≤ lowTop < middle ≤ midTop < top. */
export function bandLevels(scale: RatingScaleLevelDto[], lowTop: number, midTop: number): RatingScaleLevelDto[][] {
  return [
    scale.filter((level) => level.value <= lowTop),
    scale.filter((level) => level.value > lowTop && level.value <= midTop),
    scale.filter((level) => level.value > midTop),
  ];
}

export function bandRange(levels: RatingScaleLevelDto[]): string {
  if (levels.length === 0) return "";
  const first = levels[0]!.value;
  const last = levels[levels.length - 1]!.value;
  return first === last ? String(first) : `${first}–${last}`;
}

/** The level a drop into a band proposes: the current rating when the band holds it, else the band's nearer edge. */
export function nearestLevel(levels: RatingScaleLevelDto[], current: number): number {
  if (levels.some((level) => level.value === current)) return current;
  return levels.reduce((best, level) => Math.abs(level.value - current) < Math.abs(best - current) ? level.value : best, levels[0]!.value);
}

export interface CalibrationLocation {
  view: CalibrationView;
  filter: CalibrationFilter;
}

const VIEWS: readonly CalibrationView[] = ["distribution", "people", "nine-box"];

/** The view and filters live in the address, so a link reopens the same slice of the session. */
export function readLocation(params: URLSearchParams, potentialEnabled: boolean): CalibrationLocation {
  const asked = params.get("view") as CalibrationView | null;
  const view = asked && VIEWS.includes(asked) && (asked !== "nine-box" || potentialEnabled) ? asked : "people";
  return {
    view,
    filter: {
      unit: params.get("unit"),
      manager: params.get("manager"),
      flagged: params.get("flagged") === "true",
      notDiscussed: params.get("notDiscussed") === "true",
      q: params.get("q"),
    },
  };
}

export function writeLocation(location: CalibrationLocation): string {
  const params = new URLSearchParams();
  if (location.view !== "people") params.set("view", location.view);
  const { unit, manager, flagged, notDiscussed, q } = location.filter;
  if (unit) params.set("unit", unit);
  if (manager) params.set("manager", manager);
  if (flagged) params.set("flagged", "true");
  if (notDiscussed) params.set("notDiscussed", "true");
  if (q?.trim()) params.set("q", q.trim());
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function activeFilters(filter: CalibrationFilter): number {
  return [filter.unit, filter.manager, filter.flagged, filter.notDiscussed, filter.q?.trim()].filter(Boolean).length;
}
