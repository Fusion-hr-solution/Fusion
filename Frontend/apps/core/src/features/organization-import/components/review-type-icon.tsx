import { Box, Briefcase, Building, Building2, Network, Shapes, Users, type LucideIcon } from "lucide-react";
import { cn } from "@repo/ds";

const ICONS: Record<string, LucideIcon> = {
  organization: Building2,
  businessunit: Briefcase,
  division: Network,
  department: Building,
  team: Users,
  unit: Box,
};

/** One fixed icon per organization type, so the icon itself says what kind of unit a row is. */
export function typeIcon(typeName: string | null | undefined): LucideIcon {
  return ICONS[(typeName ?? "").toLowerCase().replace(/[^a-z]/g, "")] ?? Shapes;
}

export function ReviewTypeIcon({ typeName, className }: { typeName: string | null | undefined; className?: string }) {
  const Icon = typeIcon(typeName);
  return <Icon aria-hidden className={cn("size-4 shrink-0", className)} strokeWidth={1.75} />;
}
