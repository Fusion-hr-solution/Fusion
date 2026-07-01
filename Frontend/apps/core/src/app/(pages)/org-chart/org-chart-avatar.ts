// Initials + deterministic colour for org-chart avatars. Employees have no photo field
// yet (deferred — see .local-docs/core/audits/deferred.md), so cards render initials on a
// stable, name-derived tint. Colours use OKLCH + color-mix so they read well in light and
// dark themes without needing to know the active theme at runtime.

/** Two-letter initials from a display name (first + last word; first two letters if single word). */
export function getInitials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Stable non-negative hash of a string (djb2-ish), used to pick a hue. */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0; // force 32-bit
  }
  return Math.abs(hash);
}

/**
 * Deterministic avatar tint derived from a stable seed (use `stableEmployeeKey`). Returns a
 * subtle tinted background + matching foreground that stay legible over both light and dark
 * cards (the background is a low-alpha tint that composites onto whatever is behind it).
 */
export function getAvatarStyle(seed: string): {
  backgroundColor: string;
  color: string;
} {
  const hue = hashString(seed) % 360;
  return {
    backgroundColor: `color-mix(in oklab, oklch(0.7 0.15 ${hue}) 22%, transparent)`,
    color: `oklch(0.55 0.16 ${hue})`,
  };
}
