import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
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
  /** Optional custom footer rendered at the bottom of the sidebar */
  footer?: React.ReactNode;
  /** User panel at the very bottom, receives collapsed state */
  userPanel?: (collapsed: boolean) => React.ReactNode;
  /** List of available modules for the switcher (defaults to all platform modules) */
  modules?: SidebarModule[];
}
