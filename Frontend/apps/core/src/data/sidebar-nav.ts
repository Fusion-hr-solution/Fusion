import {
  Building,
  ClipboardList,
  LayoutDashboard,
  Network,
  Settings2,
  Users,
} from "lucide-react";
import { type NavSection } from "@repo/ui";

export const PEOPLE_NAV: NavSection = {
  title: "People",
  items: [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
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
