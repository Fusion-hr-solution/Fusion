import { LayoutDashboard, Users, Building, ClipboardList } from "lucide-react";
import { type NavSection } from "@repo/ui";

export const PEOPLE_NAV: NavSection = {
  title: "People",
  items: [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Employees", href: "/employees", icon: Users },
  ],
};

export const ADMIN_NAV: NavSection = {
  title: "Administration",
  items: [
    { label: "Setup", href: "/setup", icon: ClipboardList },
    { label: "Organizations", href: "/organizations", icon: Building },
  ],
};
