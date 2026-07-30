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
    { label: "Org Chart", href: "/org-chart", icon: Network },
  ],
};

export const ADMIN_NAV: ShellNavSection = {
  title: "Administration",
  items: [
    { label: "Setup", href: "/setup", icon: ClipboardList },
    { label: "Access", href: "/access", icon: ShieldCheck },
    { label: "Settings", href: "/settings", icon: Settings2 },
  ],
};
