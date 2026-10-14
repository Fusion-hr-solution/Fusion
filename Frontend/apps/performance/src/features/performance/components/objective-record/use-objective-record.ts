"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { objectiveHref as canonicalObjectiveHref } from "@/lib/performance-routes";
import {
  parseObjectiveMode,
  parseObjectiveRef,
  sameObjective,
  type ObjectiveRecordMode,
  type ObjectiveRef,
} from "./objective-ref";

/**
 * The objective record's state lives in the URL, so every surface opens the same record the same way,
 * a reload opens the full page, and a link to it can be shared. Opening pushes history so Back closes
 * the intercepted sheet; task-mode changes replace the current record entry.
 */
export function useObjectiveRecord() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const openRef = useMemo(() => {
    const match = pathname.match(/\/cycles\/([^/]+)\/objectives\/([^/]+)$/);
    return match ? { cycleId: decodeURIComponent(match[1]!), objectiveId: decodeURIComponent(match[2]!) } : parseObjectiveRef(params);
  }, [pathname, params]);
  const mode = useMemo(() => parseObjectiveMode(params), [params]);

  const go = useCallback(
    (ref: ObjectiveRef, nextMode: ObjectiveRecordMode = "details", replace = false) => {
      const href = canonicalObjectiveHref(ref, nextMode);
      const canonicalPath = canonicalObjectiveHref(ref);
      if (replace || pathname.endsWith(canonicalPath)) router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    },
    [router, pathname]
  );

  const open = useCallback(
    (ref: ObjectiveRef, options?: { mode?: ObjectiveRecordMode; replace?: boolean }) =>
      go(ref, options?.mode, options?.replace),
    [go]
  );
  const close = useCallback(() => router.back(), [router]);
  const isOpen = useCallback((ref: ObjectiveRef) => sameObjective(openRef, ref), [openRef]);
  /** A real link to the record on this page, for anchors that should be shareable or open in a new tab. */
  const objectiveHref = useCallback(
    (ref: ObjectiveRef, options?: { mode?: ObjectiveRecordMode }) =>
      canonicalObjectiveHref(ref, options?.mode),
    []
  );

  return { openRef, mode, open, close, isOpen, objectiveHref };
}
