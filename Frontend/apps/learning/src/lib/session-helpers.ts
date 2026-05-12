/**
 * Pure helpers for in-person training session views.
 * No React imports here so they can be unit-tested in isolation.
 */

export function formatSessionDate(isoUtc: string, locale = "en-US"): string {
  const d = new Date(isoUtc);
  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function formatSessionTimeRange(startIsoUtc: string, endIsoUtc: string, locale = "en-US"): string {
  const start = new Date(startIsoUtc);
  const end = new Date(endIsoUtc);
  const fmt: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hour12: false };
  return `${start.toLocaleTimeString(locale, fmt)} – ${end.toLocaleTimeString(locale, fmt)}`;
}

export function durationHoursBetween(startIsoUtc: string, endIsoUtc: string): number {
  const ms = new Date(endIsoUtc).getTime() - new Date(startIsoUtc).getTime();
  return Math.max(0, Math.round((ms / 3_600_000) * 10) / 10);
}

export function capacityRatio(enrolled: number, max: number): number {
  if (max <= 0) return 0;
  return enrolled / max;
}

export function isCapacityWarning(enrolled: number, max: number): boolean {
  return capacityRatio(enrolled, max) >= 0.9;
}

export function isOverlapping(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart);
}
