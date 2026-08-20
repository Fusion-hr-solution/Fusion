"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  translateWorkforceImportError,
  type WorkforceImportIntakeResult,
} from "@repo/api";

import { ImportShell } from "./import-shell";
import { WorkforceSourceIntake } from "./workforce-source-intake";
import { useActiveWorkforceImport, useWorkforceImportApi } from "../api/use-workforce-import";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Import entry — the Source surface and the single-active-session landing. It owns only the
 * pre-session steps (choose the workforce-as-of date, drop a file, pick sheet/header, or
 * resume the one import in progress). As soon as a session exists it navigates into the
 * session workspace at /core/people/import/{id}; the two share one shell grammar.
 */
export function WorkforceImportEntry() {
  const router = useRouter();
  const api = useWorkforceImportApi();
  const activeQuery = useActiveWorkforceImport();

  const [baseline, setBaseline] = useState(todayIso());
  const [intake, setIntake] = useState<WorkforceImportIntakeResult | null>(null);
  const [source, setSource] = useState<{ fileName: string; sizeLabel: string } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingFile = useRef<File | null>(null);

  const active = activeQuery.data ?? null;

  const enterSession = useCallback((id: string) => router.push(`/people/import/${id}`), [router]);

  const onFile = useCallback(
    async (file: File) => {
      setError(null);
      setSource({ fileName: file.name, sizeLabel: sizeLabel(file.size) });
      setAnalyzing(true);
      pendingFile.current = file;
      try {
        const result = await api.intake({ file, creationToken: crypto.randomUUID(), baselineDate: baseline });
        setIntake(result);
        if (result.kind === "Ready" && result.session) {
          enterSession(result.session.id);
        } else if (result.kind === "HeaderClarificationRequired" && result.session) {
          setAnalyzing(false);
        } else if (result.kind === "SheetSelectionRequired") {
          setAnalyzing(false);
        } else if (result.kind === "ActiveSessionExists") {
          setAnalyzing(false);
          activeQuery.refetch();
          setError("You already have an import in progress. Continue it above, or discard it to start a new one.");
        } else if (result.kind === "Conflict") {
          setAnalyzing(false);
          setError(result.conflictReason ?? "This import could not be started.");
        }
      } catch (e) {
        setAnalyzing(false);
        setError(translateWorkforceImportError(e).message);
      }
    },
    [api, baseline, enterSession, activeQuery]
  );

  const onSelectSheet = useCallback(
    async (name: string) => {
      const file = pendingFile.current;
      if (!file) return;
      const result = await api.intake({ file, creationToken: crypto.randomUUID(), baselineDate: baseline, selectedSheet: name });
      setIntake(result);
      if (result.kind === "Ready" && result.session) enterSession(result.session.id);
    },
    [api, baseline, enterSession]
  );

  const onSelectHeader = useCallback(
    async (rowIndex: number) => {
      if (!intake?.session) return;
      const updated = await api.selectHeader(intake.session.id, intake.session.version, rowIndex);
      enterSession(updated.id);
    },
    [api, intake, enterSession]
  );

  const sheetChoice = intake?.kind === "SheetSelectionRequired" && intake.sheetChoice
    ? { fileName: intake.sheetChoice.fileName, sheets: intake.sheetChoice.sheets }
    : null;
  const headerCandidates = intake?.kind === "HeaderClarificationRequired" ? intake.headerCandidates : null;

  return (
    <ImportShell step="source">
      <div className="px-6 py-8">
        <WorkforceSourceIntake
          baseline={baseline}
          onBaselineChange={setBaseline}
          onFile={onFile}
          source={source}
          analyzing={analyzing}
          error={error}
          sheetChoice={sheetChoice}
          headerCandidates={headerCandidates}
          onSelectSheet={onSelectSheet}
          onSelectHeader={onSelectHeader}
          activeSession={active}
          onResume={() => active && enterSession(active.id)}
          onDiscardActive={async () => {
            if (!active) return;
            await api.discard(active.id, active.version);
            activeQuery.refetch();
          }}
          onDownloadTemplate={() => { /* template download wired later */ }}
        />
      </div>
    </ImportShell>
  );
}

function sizeLabel(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
