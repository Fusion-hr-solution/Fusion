"use client";

import { usePathname } from "next/navigation";
import { getCorePathname, getRoutePageSkeleton } from "@/shell/route-skeletons";

// Organization's own loading boundary draws the chart; the import has its own stage skeletons.
export default function OrganizationImportLoading() {
  return <>{getRoutePageSkeleton(getCorePathname(usePathname()))}</>;
}
