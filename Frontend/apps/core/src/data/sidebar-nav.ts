import {
  ClipboardList,
  LayoutDashboard,
  Network,
  Settings2,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { type ShellNavSection } from "@repo/ds/shell";

export const PEOPLE_NAV: ShellNavSection = {
  title: "People",
  items: [
    { label: "Overview", href: "/", icon: LayoutDashboard },
    { label: "My Profile", href: "/profile", icon: User },
    { label: "My Team", href: "/team", icon: Users },
    { label: "Employees", href: "/employees", icon: Users },
    { label: "Organization", href: "/organization", icon: Network },
  ],
};

export const ADMIN_NAV: ShellNavSection = {
  title: "Administration",
  items: [
    // Temporary tenant-foundation orientation, reached at the shell-canonical
    // `/getting-started` (it lives outside the Core basePath). Not a permanent
    // primary destination — offered while administrators establish the tenant.
    {
      label: "Getting started",
      href: "/getting-started",
      navigateHref: "/getting-started",
      shellRoute: true,
      icon: ClipboardList,
    },
    { label: "Access", href: "/access", icon: ShieldCheck },
    { label: "Settings", href: "/settings", icon: Settings2 },
  ],
};
