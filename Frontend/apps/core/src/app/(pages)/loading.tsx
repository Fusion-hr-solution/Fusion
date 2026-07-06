"use client";

import { usePathname } from "next/navigation";
import {
  getCorePathname,
  getRoutePageSkeleton,
} from "@/shell/route-skeletons";

// Route-group loading boundary: renders INSIDE CorePagesShell (frame persists)
// and shows the TARGET route's dedicated skeleton — the same component the
// page's own loading branch renders — so the transition reads as one skeleton.
export default function PagesLoading() {
  const pathname = usePathname();
  return <>{getRoutePageSkeleton(getCorePathname(pathname))}</>;
}
