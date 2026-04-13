import {
  LayoutDashboard,
  Users,
  Building2,
  Briefcase,
  Building,
  Settings,
} from "lucide-react";
import { type NavSection } from "@repo/ui";

export const PEOPLE_NAV: NavSection = {
  title: "People",
  items: [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Employees", href: "/employees", icon: Users },
    { label: "Departments", href: "/departments", icon: Building2 },
    { label: "Positions", href: "/positions", icon: Briefcase },
  ],
};

export const ADMIN_NAV: NavSection = {
  title: "Administration",
  items: [
    { label: "Organizations", href: "/organizations", icon: Building },
    { label: "Settings", href: "/settings", icon: Settings },
  ],
};
