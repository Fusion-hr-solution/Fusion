/** Shared budget consumption color thresholds: green <80, orange 80–90, red >90. */
export function pctBarClass(p: number): string {
  if (p > 90) return "bg-[hsl(var(--ey-red-500))]";
  if (p >= 80) return "bg-[hsl(var(--ey-orange-500))]";
  return "bg-[hsl(var(--ey-green-500))]";
}

export function pctHexColor(p: number): string {
  if (p > 90) return "#ef4444";
  if (p >= 80) return "#f59e0b";
  return "#10b981";
}
