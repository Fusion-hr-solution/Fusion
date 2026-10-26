"use client";

import { useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";

const KINDS = new Set(["rejected", "needs-input", "conflict", "concurrency", "not-found", "access-denied", "temporary"]);

/**
 * What an import request's failure says: the message `@repo/api` hands over (the server's own, written in English) in
 * English; the screen's line for its kind otherwise.
 */
export function useImportProblem(): (problem: { kind: string; message: string }) => string {
  const t = useTranslations("dataImport.problemKind");
  const english = useLocale() === "en";
  return useCallback(
    (problem) =>
      english || !KINDS.has(problem.kind) ? problem.message : t(problem.kind as "temporary"),
    [english, t]
  );
}
