"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  parseObjectiveMode,
  parseObjectiveRef,
  sameObjective,
  withObjectiveRef,
  type ObjectiveRecordMode,
  type ObjectiveRef,
} from "./objective-ref";

/**
 * The objective record's state lives in the URL, so every surface opens the same record the same way,
 * a reload reopens it, and a link to it can be shared. Opening replaces history rather than pushing it:
 * inspecting objectives is not navigation the Back button should have to unwind.
 */
export function useObjectiveRecord() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const openRef = useMemo(() => parseObjectiveRef(params), [params]);
  const mode = useMemo(() => parseObjectiveMode(params), [params]);

  const go = useCallback(
    (ref: ObjectiveRef | null, nextMode: ObjectiveRecordMode = "details") =>
      router.replace(`${pathname}${withObjectiveRef(params, ref, nextMode)}`, { scroll: false }),
    [router, pathname, params]
  );

  const open = useCallback(
    (ref: ObjectiveRef, options?: { mode?: ObjectiveRecordMode }) => go(ref, options?.mode),
    [go]
  );
  const close = useCallback(() => go(null), [go]);
  const isOpen = useCallback((ref: ObjectiveRef) => sameObjective(openRef, ref), [openRef]);
  /** A real link to the record on this page, for anchors that should be shareable or open in a new tab. */
  const objectiveHref = useCallback(
    (ref: ObjectiveRef, options?: { mode?: ObjectiveRecordMode }) =>
      `${pathname}${withObjectiveRef(params, ref, options?.mode)}`,
    [pathname, params]
  );

  return { openRef, mode, open, close, isOpen, objectiveHref };
}
