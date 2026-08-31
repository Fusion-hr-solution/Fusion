"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ds";
import {
  translateWorkforceImportError,
  type WorkforceImportIntakeResult,
} from "@repo/api";
import { canImportCoreEmployees, useAuth } from "@repo/auth";
import { toast } from "sonner";

import { useActiveWorkforceImport, useWorkforceImportApi } from "../api/use-workforce-import";
import { downloadBlob, formatHumanDate } from "@/features/organization-import/model/format";
import {
  ImportOnramp,
  type OnrampDropState,
  type ImportOnrampGate,
} from "@/features/data-import/components/import-onramp";
import { workforceOnrampConfig } from "@/features/data-import/model/import-descriptor";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Workforce import entry — the pre-session on-ramp. It owns only the steps before a session
 * exists (choose the workforce-as-of date, add a file, resolve sheet/header, or resume the
 * one import in progress), then navigates into the session workspace at
 * /people/import/{id}. The rendering is the shared Import on-ramp; this adapter maps the
 * workforce intake flow onto it.
 */
export function WorkforceImportEntry() {
  const router = useRouter();
  const api = useWorkforceImportApi();
  const activeQuery = useActiveWorkforceImport();
  const { user, isLoading } = useAuth();

  const [baseline, setBaseline] = useState(todayIso());
  const [intake, setIntake] = useState<WorkforceImportIntakeResult | null>(null);
  const [source, setSource] = useState<{ fileName: string } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingFile = useRef<File | null>(null);

  const active = activeQuery.data ?? null;

  const enterSession = useCallback((id: string) => router.push(`/people/import/${id}`), [router]);

  const clearSource = useCallback(() => {
    setError(null);
    setSource(null);
    setIntake(null);
    setAnalyzing(false);
    pendingFile.current = null;
  }, []);

  const onDownloadTemplate = useCallback(async () => {
    try {
      downloadBlob(await api.downloadTemplate(), "Fusion-workforce-template.xlsx");
    } catch (e) {
      toast.error("Template could not be downloaded", {
        description: translateWorkforceImportError(e).message,
      });
    }
  }, [api]);

  const onFile = useCallback(
    async (file: File) => {
      setError(null);
      setIntake(null);
      setSource({ fileName: file.name });
      setAnalyzing(true);
      pendingFile.current = file;
      try {
        const result = await api.intake({ file, creationToken: crypto.randomUUID(), baselineDate: baseline });
        setIntake(result);
        setAnalyzing(false);
        if (result.kind === "Ready" && result.session) {
          setAnalyzing(true);
          enterSession(result.session.id);
        } else if (result.kind === "ActiveSessionExists") {
          activeQuery.refetch();
          setError("You already have an import in progress. Continue it above, or discard it to start a new one.");
        } else if (result.kind === "Conflict") {
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
      setAnalyzing(true);
      setIntake(null);
      try {
        const result = await api.intake({
          file,
          creationToken: crypto.randomUUID(),
          baselineDate: baseline,
          selectedSheet: name,
        });
        setIntake(result);
        setAnalyzing(false);
        if (result.kind === "Ready" && result.session) {
          setAnalyzing(true);
          enterSession(result.session.id);
        }
      } catch (e) {
        setAnalyzing(false);
        setError(translateWorkforceImportError(e).message);
      }
    },
    [api, baseline, enterSession]
  );

  const onSelectHeader = useCallback(
    async (rowIndex: number) => {
      if (!intake?.session) return;
      setAnalyzing(true);
      const updated = await api.selectHeader(intake.session.id, intake.session.version, rowIndex);
      enterSession(updated.id);
    },
    [api, intake, enterSession]
  );

  const gate: ImportOnrampGate | undefined = isLoading
    ? { loading: true }
    : !canImportCoreEmployees(user)
      ? {
          denied: {
            title: "Workforce import access required",
            description: "You don’t have permission to import workforce into this tenant.",
            action: (
              <Button asChild variant="outline">
                <Link href="/people">Back to People</Link>
              </Button>
            ),
          },
        }
      : undefined;

  const drop: OnrampDropState = error
    ? { kind: "rejected", fileName: source?.fileName ?? "This file could not be read", message: error }
    : source && analyzing
      ? { kind: "busy", fileName: source.fileName }
      : { kind: "idle" };

  const sheet =
    intake?.kind === "SheetSelectionRequired" && intake.sheetChoice
      ? {
          fileName: intake.sheetChoice.fileName,
          sheets: intake.sheetChoice.sheets.map((s) => ({
            name: s.name,
            rows: s.rowCount,
            columns: s.columnCount,
          })),
          onSelect: onSelectSheet,
        }
      : null;

  const header =
    intake?.kind === "HeaderClarificationRequired" && intake.headerCandidates
      ? { candidates: intake.headerCandidates, onSelect: onSelectHeader }
      : null;

  return (
    <ImportOnramp
      config={workforceOnrampConfig}
      gate={gate}
      date={{ value: baseline, today: todayIso(), onChange: setBaseline }}
      resume={
        active
          ? [
              {
                id: active.id,
                fileName: active.source.fileName ?? "Uploaded file",
                asOfLabel: formatHumanDate(active.baselineDate),
                counts: {
                  newCount: active.counts.newCount,
                  existingCount: active.counts.existingAnchorCount,
                  needsAttention: active.counts.needsAttentionCount,
                },
                onResume: () => enterSession(active.id),
                onDiscard: async () => {
                  await api.discard(active.id, active.version);
                  activeQuery.refetch();
                },
              },
            ]
          : null
      }
      drop={drop}
      sheet={sheet}
      header={header}
      onFile={(file) => void onFile(file)}
      onRetry={clearSource}
      onRemove={clearSource}
      onDownloadTemplate={() => void onDownloadTemplate()}
    />
  );
}
