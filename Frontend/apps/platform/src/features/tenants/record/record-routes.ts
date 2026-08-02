import {
  Activity,
  Boxes,
  KeyRound,
  LayoutDashboard,
  ScrollText,
  Settings2,
  type LucideIcon,
} from "lucide-react";

/**
 * Where the tenant record's destinations are, and how a link to one is built.
 *
 * Pure, and separate from the shell, because two of these rules are easy to get
 * subtly wrong and impossible to notice: the active-destination comparison has
 * to strip the shell's base path, and the directory query has to be re-encoded
 * rather than spliced in — it carries its own `=` and `&`, so appending it raw
 * makes the record's route absorb it and lose the way back.
 */

export interface RecordDestination {
  /** Appended to the tenant route. Empty is the record's base destination. */
  segment: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Fixed, and in this order, for every tenant in every state. An operator who
 * learns where Audit is on one tenant must not have to look for it on another.
 */
export const RECORD_DESTINATIONS: RecordDestination[] = [
  { segment: "", label: "Overview", icon: LayoutDashboard },
  { segment: "access", label: "Access", icon: KeyRound },
  { segment: "entitlements", label: "Entitlements", icon: Boxes },
  { segment: "operations", label: "Operations", icon: Activity },
  { segment: "audit", label: "Audit", icon: ScrollText },
  { segment: "settings", label: "Settings", icon: Settings2 },
];

/** The tenant's base route, which is also its Overview destination. */
export function recordBaseHref(tenantId: string): string {
  return `/tenants/${tenantId}`;
}

export function destinationHref(tenantId: string, segment: string): string {
  const base = recordBaseHref(tenantId);
  return segment ? `${base}/${segment}` : base;
}

/**
 * The suffix every link inside the record carries so the directory behind it
 * survives. Re-encoded, not appended raw.
 */
export function recordQuery(from: string | null): string {
  return from ? `?from=${encodeURIComponent(from)}` : "";
}

/** Where the back control goes: the directory, with the query already on it. */
export function directoryHref(from: string | null): string {
  return `/tenants${from ? `?${from}` : ""}`;
}

/**
 * Whether a destination is the one being viewed. The shell serves this app
 * under a base path, so the comparison is made on the app's own route rather
 * than on what the browser shows.
 */
export function isActiveDestination(
  pathname: string,
  tenantId: string,
  segment: string
): boolean {
  const current = pathname.replace(/^\/platform/, "") || "/";
  return current === destinationHref(tenantId, segment);
}
