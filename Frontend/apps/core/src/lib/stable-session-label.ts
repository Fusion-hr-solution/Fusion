/**
 * Deterministic pseudo session label from React `useId()` — same on server and client (avoids hydration mismatch).
 */
export function stableSessionLabelFromReactId(reactId: string): string {
  let h = 2166136261;
  for (let i = 0; i < reactId.length; i++) {
    h ^= reactId.charCodeAt(i)!;
    h = Math.imul(h, 16777619);
  }
  const u = (h >>> 0).toString(16).padStart(8, "0");
  return `FUS-${u.slice(0, 4).toUpperCase()}-${u.slice(4, 8).toUpperCase()}`;
}
