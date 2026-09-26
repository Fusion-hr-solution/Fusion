"use client";

import { usePathname } from "next/navigation";
import { getCorePathname, getRoutePageSkeleton } from "@/shell/route-skeletons";

// The import has its own stage skeletons, keyed by route.
export default function WorkforceImportLoading() {
  return <>{getRoutePageSkeleton(getCorePathname(usePathname()))}</>;
}
