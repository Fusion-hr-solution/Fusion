"use client";

import { useCallback, useRef, useState } from "react";
import { Button, Spinner, cn } from "@repo/ds";
import { StatusBadge } from "@repo/ds/shell";
import { ArrowRight, FileSpreadsheet, UploadCloud } from "lucide-react";
import { formatWorkforceDate } from "@/features/people/components/workforce-ui";
import type {
  WorkforceHeaderCandidate,
  WorkforceImportSheetSummary,
  WorkforceImportSessionDto,
} from "@repo/api";
import { BaselineControl } from "./workforce-baseline";

/**
 * Source intake — the first impression. An authored, wide work area (not a centered
 * upload card in whitespace): task context, the Workforce-as-of business date, an
 * integrated dropzone, and a quiet template affordance. When a file is dropped the
 * dropzone becomes the source identity in place; the page never blanks to a spinner.
 */
/** The single-footprint drop-surface phase — idle, analyzing, or a rejected source. */
type IntakePhase =
  | { kind: "idle" }
  | { kind: "analyzing"; fileName: string; sizeLabel: string }
  | { kind: "error"; fileName: string | null; sizeLabel: string | null; message: string };

export function WorkforceSourceIntake({
  baseline,
  onBaselineChange,
  onFile,
  source,
  analyzing,
  error,
  sheetChoice,
  headerCandidates,
  onSelectSheet,
  onSelectHeader,
  activeSession,
  onResume,
  onDiscardActive,
  onDownloadTemplate,
}: {
  baseline: string;
  onBaselineChange: (date: string) => void;
  onFile: (file: File) => void;
  source: { fileName: string; sizeLabel: string } | null;
  analyzing: boolean;
  error: string | null;
  sheetChoice: { fileName: string; sheets: WorkforceImportSheetSummary[] } | null;
  headerCandidates: WorkforceHeaderCandidate[] | null;
  onSelectSheet: (name: string) => void;
  onSelectHeader: (rowIndex: number) => void;
  activeSession: WorkforceImportSessionDto | null;
  onResume: () => void;
  onDiscardActive: () => void;
  onDownloadTemplate: () => void;
}) {
  const phase: IntakePhase = error
    ? { kind: "error", fileName: source?.fileName ?? null, sizeLabel: source?.sizeLabel ?? null, message: error }
    : source && analyzing
      ? { kind: "analyzing", fileName: source.fileName, sizeLabel: source.sizeLabel }
      : { kind: "idle" };
  if (sheetChoice) {
    return <SheetSelector fileName={sheetChoice.fileName} sheets={sheetChoice.sheets} onSelect={onSelectSheet} />;
  }
  if (headerCandidates) {
    return <HeaderSelector candidates={headerCandidates} onSelect={onSelectHeader} />;
  }

  return (
    <div>
      {activeSession ? (
        <div className="mb-8">
          <ResumeStrip session={activeSession} onResume={onResume} onDiscard={onDiscardActive} />
        </div>
      ) : null}

      {activeSession ? (
        <h2 className="type-label font-semibold text-foreground">Start a new import</h2>
      ) : (
        <p className="mt-1 max-w-xl type-body text-muted-foreground">
          Bring the workforce you already have into Fusion. We&apos;ll interpret your file and ask only
          about anything that needs clarification.
        </p>
      )}

      <div className="mt-6 max-w-3xl">
        <BaselineControl value={baseline} onChange={onBaselineChange} />
      </div>

      <div className="mt-6">
        <UploadSurface phase={phase} onFile={onFile} />
      </div>

      <div className="mt-6 flex items-center gap-2 text-muted-foreground">
        <span className="type-meta">Need a starting point?</span>
        <button
          type="button"
          onClick={onDownloadTemplate}
          className="type-meta font-medium text-foreground underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Download Fusion template
        </button>
      </div>
    </div>
  );
}

/**
 * One drop surface for every pre-sheet state. The outer region keeps a constant
 * footprint (fixed min-height, centered stack, dashed border) so idle → analyzing →
 * rejected change *inside* it instead of swapping in a differently shaped card. Only
 * the icon, primary line, action slot, and the reserved lower line change — geometry
 * does not — so the surface never jitters. (Mirrors the Organization import surface.)
 */
function UploadSurface({ phase, onFile }: { phase: IntakePhase; onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const pick = useCallback(() => inputRef.current?.click(), []);

  const idle = phase.kind === "idle";
  const analyzing = phase.kind === "analyzing";
  const error = phase.kind === "error";
  const fileName = phase.kind === "idle" ? null : phase.fileName;

  return (
    <div
      role="region"
      aria-label="Workforce source drop area"
      onDragOver={(event) => {
        event.preventDefault();
        if (!analyzing) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (analyzing) return;
        const file = event.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
      className={cn(
        "grid min-h-56 place-items-center rounded-lg border border-dashed px-6 py-8 text-center transition-colors duration-[var(--duration-normal)]",
        dragging
          ? "border-primary/60 bg-primary/5"
          : idle
            ? "border-border bg-foreground/[0.035] hover:border-border/80 hover:bg-foreground/[0.05]"
            : analyzing
              ? "border-primary/40 bg-primary/[0.04]"
              : "border-destructive/45 bg-destructive/[0.035]"
      )}
    >
      <div
        role={analyzing ? "status" : error ? "alert" : undefined}
        aria-live={analyzing ? "polite" : undefined}
        className="flex w-full max-w-sm flex-col items-center outline-none"
      >
        <span
          className={cn(
            "grid size-12 place-items-center rounded-full ring-1 ring-inset transition-colors",
            error
              ? "bg-destructive/10 text-destructive ring-destructive/25"
              : analyzing
                ? "bg-primary/10 text-primary ring-primary/25"
                : "bg-card text-muted-foreground ring-border"
          )}
        >
          {idle ? <UploadCloud className="size-5" aria-hidden /> : <FileSpreadsheet className="size-5" aria-hidden />}
        </span>

        <p className="mt-3 w-full truncate px-2 type-label font-semibold text-foreground">
          {idle ? (dragging ? "Drop to upload" : "Drop an Excel or CSV file here") : fileName ?? "This file could not be read"}
        </p>

        {/* Action slot — fixed height so swapping button ↔ spinner never shifts the layout. */}
        <div className="mt-3 flex min-h-9 items-center justify-center">
          {idle ? (
            <button
              type="button"
              onClick={pick}
              className="type-meta font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              or choose a file
            </button>
          ) : analyzing ? (
            <span className="flex items-center gap-2 type-meta text-muted-foreground">
              <Spinner className="size-4" aria-hidden />
              Analyzing source…
            </span>
          ) : (
            <Button variant="outline" size="sm" onClick={pick}>
              Choose another file
            </Button>
          )}
        </div>

        {/* Reserved lower line — always present so the box height is state-independent. */}
        <p className={cn("mt-3 min-h-4 type-meta", error ? "text-destructive" : "text-muted-foreground")}>
          {idle
            ? ".xlsx · .csv · up to 10 MB"
            : analyzing
              ? phase.sizeLabel
              : phase.kind === "error"
                ? phase.message
                : ""}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}

function ResumeStrip({
  session,
  onResume,
  onDiscard,
}: {
  session: WorkforceImportSessionDto;
  onResume: () => void;
  onDiscard: () => void;
}) {
  const { newCount, existingAnchorCount, needsAttentionCount } = session.counts;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-lg border border-border bg-card px-4 py-3 shadow-[var(--shadow-raised)]">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="truncate type-label font-semibold text-foreground">
            {session.source.fileName ?? "Uploaded file"}
          </p>
          <span className="shrink-0 type-meta text-muted-foreground">· Current import</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 type-meta text-muted-foreground">
          <span>Workforce as of {formatWorkforceDate(session.baselineDate)}</span>
          <span aria-hidden className="text-border">·</span>
          <span><span className="font-semibold text-foreground tabular-nums">{newCount}</span> new</span>
          <span aria-hidden className="text-border">·</span>
          <span><span className="font-semibold text-foreground tabular-nums">{existingAnchorCount}</span> existing</span>
          {needsAttentionCount > 0 ? (
            <StatusBadge tone="warning" dot>
              {needsAttentionCount} {needsAttentionCount === 1 ? "person needs" : "people need"} attention
            </StatusBadge>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button onClick={onResume}>
          Continue import
          <ArrowRight className="size-4" aria-hidden />
        </Button>
        <Button variant="ghost" onClick={onDiscard} className="text-muted-foreground">
          Discard
        </Button>
      </div>
    </div>
  );
}

function SheetSelector({
  fileName,
  sheets,
  onSelect,
}: {
  fileName: string;
  sheets: WorkforceImportSheetSummary[];
  onSelect: (name: string) => void;
}) {
  const [selected, setSelected] = useState(sheets[0]?.name ?? "");
  return (
    <div className="max-w-xl">
      <p className="mt-1 type-body text-muted-foreground">
        Which sheet contains your workforce? <span className="text-muted-foreground/70">{fileName}</span>
      </p>
      <ul className="mt-6 divide-y divide-border rounded-lg border border-border">
        {sheets.map((sheet) => (
          <li key={sheet.name}>
            <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/40">
              <input
                type="radio"
                name="sheet"
                checked={selected === sheet.name}
                onChange={() => setSelected(sheet.name)}
                className="size-4 accent-[var(--color-primary)]"
              />
              <span className="min-w-0 flex-1">
                <span className="block type-label font-medium text-foreground">{sheet.name}</span>
                <span className="type-meta text-muted-foreground tabular-nums">
                  {sheet.rowCount} rows · {sheet.columnCount} columns
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <Button className="mt-5" onClick={() => onSelect(selected)} disabled={!selected}>
        Continue
        <ArrowRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

function HeaderSelector({
  candidates,
  onSelect,
}: {
  candidates: WorkforceHeaderCandidate[];
  onSelect: (rowIndex: number) => void;
}) {
  const [selected, setSelected] = useState(candidates.at(-1)?.rowIndex ?? candidates[0]?.rowIndex ?? 0);
  return (
    <div className="max-w-2xl">
      <p className="mt-1 type-body text-muted-foreground">Which row contains the column names?</p>
      <ul className="mt-6 space-y-2">
        {candidates.map((candidate) => (
          <li key={candidate.rowIndex}>
            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors",
                selected === candidate.rowIndex ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/40"
              )}
            >
              <input
                type="radio"
                name="header"
                checked={selected === candidate.rowIndex}
                onChange={() => setSelected(candidate.rowIndex)}
                className="mt-0.5 size-4 accent-[var(--color-primary)]"
              />
              <span className="min-w-0 flex-1 overflow-x-auto">
                <span className="type-meta text-muted-foreground">Row {candidate.rowIndex + 1}</span>
                <span className="mt-1 flex gap-2 whitespace-nowrap type-code text-xs text-foreground">
                  {candidate.preview.map((cell, i) => (
                    <span key={i} className="text-muted-foreground/90">
                      {cell || "—"}
                      {i < candidate.preview.length - 1 ? <span className="ml-2 text-border">|</span> : null}
                    </span>
                  ))}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <Button className="mt-5" onClick={() => onSelect(selected)}>
        Use this row
        <ArrowRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
