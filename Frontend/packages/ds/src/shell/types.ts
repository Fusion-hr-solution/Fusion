import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** A single navigation destination within a module. `href` is module-relative (basePath is prepended). */
export interface ShellNavItem {
  label: string;
  /** Module-relative path used for active-state matching (e.g. "/employees"). */
  href: string;
  /** Full link target if it differs from `${basePath}${href}` (e.g. with tenant-context query). */
  navigateHref?: string;
  icon: LucideIcon;
  badge?: string | number;
  disabled?: boolean;
  disabledReason?: string;
  /**
   * Access state not yet known: rendered visually identical to enabled but inert
   * (no navigation), so items never flash enabled→locked while access resolves.
   */
  pending?: boolean;
  /** Only an exact path match marks this item active (default: prefix match). */
  exact?: boolean;
}

/** A titled group of nav items, organized by the user's job (not by technical module boundary). */
export interface ShellNavSection {
  title?: string;
  items: ShellNavItem[];
}

/** A module the user can switch to (Core ↔ Performance). `href` is an absolute app path (e.g. "/core"). */
export interface ShellModule {
  key: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  href: string;
}

export interface ModuleSidebarProps {
  brandTitle: string;
  brandSubtitle?: string;
  brandIcon: LucideIcon;
  /** Current path within the module (e.g. "/employees"), used for active state. Nav hrefs are
   *  module-relative; Next.js auto-prepends the app basePath, so no basePath prop is needed. */
  activePath: string;
  sections: ShellNavSection[];
  /** Modules available in the switcher; `currentModuleKey` marks the active one. */
  modules?: ShellModule[];
  currentModuleKey?: string;
  /** Optional tenant switcher / context control rendered under the brand. */
  tenantSwitcher?: ReactNode;
  /** Optional short role/context label shown in the header area. */
  contextLabel?: string;
  /** User panel at the very bottom; receives the collapsed state. */
  userPanel?: (collapsed: boolean) => ReactNode;
  collapsible?: boolean;
  /**
   * Nav content not yet known (e.g. auth still hydrating): renders skeleton nav
   * rows in the nav area while keeping the real brand header and footer.
   */
  pending?: boolean;
}
