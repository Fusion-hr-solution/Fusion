"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { objectiveHref } from "@/lib/performance-routes";
import { parseObjectiveMode, parseObjectiveRef } from "./objective-ref";

/**
 * Older links carried the objective record as `?cycle=&objective=[&mode=record]` on any page. They now
 * replace themselves with the canonical record address; a soft replace keeps the current workspace
 * under the record, exactly as opening it in context does.
 */
export function LegacyRecordRedirect() {
  const router = useRouter();
  const params = useSearchParams();
  const ref = parseObjectiveRef(params);
  const target = ref ? objectiveHref(ref, parseObjectiveMode(params)) : null;

  useEffect(() => {
    if (target) router.replace(target, { scroll: false });
  }, [router, target]);

  return null;
}
