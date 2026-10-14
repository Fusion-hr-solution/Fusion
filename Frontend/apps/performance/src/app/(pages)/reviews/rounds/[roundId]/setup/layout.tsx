"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ReviewRoundSetupShell } from "@/features/performance/components/reviews/review-round-setup-shell";

export default function ReviewRoundSetupLayout({ children }: { children: ReactNode }) {
  const path = usePathname();
  const step = path.endsWith("/population") ? "population" : path.endsWith("/review") ? "review" : "details";
  return <ReviewRoundSetupShell step={step}>{children}</ReviewRoundSetupShell>;
}
