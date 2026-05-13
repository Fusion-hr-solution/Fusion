import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  disabled?: boolean;
  disabledReason?: string;
  /** When true, only exact path match activates this item */
  exact?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export interface SidebarModule {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface AppSidebarProps {
  /** Which module is currently active (must match a label in MODULES) */
  activeModule: string;
  /** The current path within the module (e.g. "/" or "/my-trainings"), used for active state */
  activePath: string;
  /** Navigation sections to render (e.g. employee nav, admin nav) */
  sections: NavSection[];
  /** Brand icon shown in the sidebar header */
  brandIcon: LucideIcon;
  /** Brand title shown next to the icon */
  brandTitle: string;
  /** Brand subtitle shown below the title */
  brandSubtitle?: string;
  /** Next.js basePath for the module (e.g. "/learning"), prepended to nav hrefs */
  basePath?: string;
  /** Optional custom footer rendered at the bottom of the sidebar, receives collapsed state */
  footer?: (collapsed: boolean) => ReactNode;
  /** User panel at the very bottom, receives collapsed state */
  userPanel?: (collapsed: boolean) => ReactNode;
  /** List of available modules for the switcher (defaults to all platform modules) */
  modules?: SidebarModule[];
  /** Optional local theme override for the sidebar surface. */
  style?: CSSProperties;
  /** Optional local theme override for the module switcher popover content. */
  moduleSwitcherContentStyle?: CSSProperties;
  /** Optional local theme override for the module switcher trigger surface. */
  moduleSwitcherTriggerStyle?: CSSProperties;
}
