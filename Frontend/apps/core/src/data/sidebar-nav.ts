import {
  Building,
  ClipboardList,
  LayoutDashboard,
  Network,
  Settings2,
  User,
  Users,
} from "lucide-react";
import { type NavSection } from "@repo/ui";

export const PEOPLE_NAV: NavSection = {
  title: "People",
  items: [
    { label: "Overview", href: "/", icon: LayoutDashboard },
    { label: "My Profile", href: "/profile", icon: User },
    { label: "My Team", href: "/team", icon: Users },
    { label: "Employees", href: "/employees", icon: Users },
    { label: "Org Chart", href: "/org-chart", icon: Network },
  ],
};

export const ADMIN_NAV: NavSection = {
  title: "Administration",
  items: [
    { label: "Setup", href: "/setup", icon: ClipboardList },
    { label: "Settings", href: "/settings", icon: Settings2 },
    { label: "Organizations", href: "/organizations", icon: Building },
  ],
};
