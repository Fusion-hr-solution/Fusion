// ── Weight helpers ───────────────────────────────────────────────────────────

export function parseWeightValues(csv: string): number[] {
  return Array.from(
    new Set(
      csv
        .split(",")
        .map((w) => Number(w.trim()))
        .filter((n) => Number.isInteger(n) && n > 0 && n <= 100 && n % 5 === 0),
    ),
  ).sort((a, b) => a - b);
}

export function formatWeightValues(values: number[]): string {
  return values.join(",");
}

// ── Measurement type helpers ─────────────────────────────────────────────────

export type MeasurementSet = { numeric: boolean; qualitative: boolean };

export function parseMeasurementTypes(csv: string): MeasurementSet {
  const parts = csv.split(",").map((s) => s.trim());
  return {
    numeric: parts.includes("Quantitative"),
    qualitative: parts.includes("Qualitative"),
  };
}

export function formatMeasurementTypes(set: MeasurementSet): string {
  const parts: string[] = [];
  if (set.numeric) parts.push("Quantitative");
  if (set.qualitative) parts.push("Qualitative");
  return parts.join(",");
}

export function labelMeasurementTypes(csv: string): string {
  const set = parseMeasurementTypes(csv);
  if (set.numeric && set.qualitative) return "Numeric targets & qualitative outcomes";
  if (set.numeric) return "Numeric targets only";
  if (set.qualitative) return "Qualitative outcomes only";
  return "—";
}

/** Product label for a single frozen measurement-method token (team objectives). */
export function measurementMethodLabel(token: string): string {
  switch (token) {
    case "Quantitative":
      return "Numeric target";
    case "Qualitative":
      return "Qualitative outcome";
    default:
      return token;
  }
}

// ── Date formatting ──────────────────────────────────────────────────────────

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}
