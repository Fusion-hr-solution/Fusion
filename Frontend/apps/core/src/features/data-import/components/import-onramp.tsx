"use client";

import Link from "next/link";
import { useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Spinner,
  cn,
} from "@repo/ds";
import {
  PageContainer,
  PageHeader,
  PagePermissionNotice,
  PageSkeleton,
  StatusBadge,
} from "@repo/ds/shell";
import {
  ArrowLeft,
  ArrowRight,
  FileDown,
  FileOutput,
  FileSpreadsheet,
  RotateCcw,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { ImportDateControl } from "./import-date-control";
import { ImportProcessing, type ImportProcessingPhase } from "./import-processing";
import type { ImportOnrampConfig } from "../model/import-descriptor";

/** The dropzone's single-footprint state — idle, reading, or a source that needs a fix. */
export type OnrampDropState =
  | { kind: "idle" }
  | { kind: "busy"; fileName: string }
  | { kind: "rejected"; fileName: string; message: string }
  | { kind: "temporary"; fileName: string; message: string };

export type OnrampResumeItem = {
  id: string;
  fileName: string;
  asOfLabel: string;
  /** Quiet recency/actor line (Organization list). */
  metaLine?: ReactNode;
  /** Establishment counts (Workforce single resume). */
  counts?: { newCount: number; existingCount: number; needsAttention: number };
  href?: string;
  onResume?: () => void;
  onDiscard?: () => void;
};

export type OnrampSheetOption = {
  name: string;
  rows?: number;
  columns?: number;
};
export type OnrampHeaderCandidate = {
  rowIndex: number;
  preview: (string | null)[];
};

export type ImportOnrampGate = {
  loading?: boolean;
  denied?: { title: string; description: string; action?: ReactNode };
};

export type ImportOnrampProps = {
  config: ImportOnrampConfig;
  gate?: ImportOnrampGate;
  date: { value: string; today: string; onChange: (value: string) => void };
  resume?: OnrampResumeItem[] | null;
  drop: OnrampDropState;
  /** When present, the surface asks which worksheet to read (replaces the dropzone). */
  sheet?: {
    fileName?: string | null;
    sheets: OnrampSheetOption[];
    onSelect: (name: string) => void;
  } | null;
  /** Workforce-only header-row clarification (replaces the dropzone). */
  header?: {
    candidates: OnrampHeaderCandidate[];
    onSelect: (rowIndex: number) => void;
  } | null;
  /** When present, the staged upload → interpret → review hand-off replaces the dropzone. */
  processing?: { phase: ImportProcessingPhase; fileName: string } | null;
  onFile: (file: File) => void;
  onRetry: () => void;
  onRemove: () => void;
  onDownloadTemplate: () => void;
  onExport?: (() => void) | null;
  exportLabel?: string;
};

const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

export function ImportOnramp({
  config,
  gate,
  date,
  resume,
  drop,
  sheet,
  header,
  processing,
  onFile,
  onRetry,
  onRemove,
  onDownloadTemplate,
  onExport,
  exportLabel = "Export current structure",
}: ImportOnrampProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  if (gate?.loading) {
    return <PageSkeleton rows={5} label={`Loading ${config.title}`} />;
  }
  if (gate?.denied) {
    return (
      <PageContainer width="narrow" className="space-y-6">
        <PageHeader title={config.title} />
        <PagePermissionNotice
          title={gate.denied.title}
          description={gate.denied.description}
          action={gate.denied.action}
        />
      </PageContainer>
    );
  }

  const busy = drop.kind === "busy";

  return (
    <PageContainer className="space-y-8 pb-16">
      <div className="space-y-4">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit text-muted-foreground"
        >
          <Link href={config.back.href}>
            <ArrowLeft className="size-4" aria-hidden />
            {config.back.label}
          </Link>
        </Button>
        <PageHeader
          className="mb-0"
          title={config.title}
          actions={
            <>
              <Button variant="outline" size="sm" onClick={onDownloadTemplate}>
                <FileDown className="size-4" aria-hidden />
                {config.copy.templateLabel}
              </Button>
              {onExport ? (
                <Button variant="outline" size="sm" onClick={onExport}>
                  <FileOutput className="size-4" aria-hidden />
                  {exportLabel}
                </Button>
              ) : null}
            </>
          }
        />
        <ImportDateControl
          config={config.date}
          value={date.value}
          onChange={date.onChange}
          today={date.today}
        />
      </div>

      {processing || !resume?.length ? null : <ResumeBand items={resume} />}

      <section aria-labelledby="import-onramp-source" className="space-y-4">
        {processing ? (
          <h2 id="import-onramp-source" className="sr-only">
            Bringing in your source
          </h2>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <h2
              id="import-onramp-source"
              className="type-title font-semibold text-foreground"
            >
              {resume?.length ? "Start a new import" : "Add your source"}
            </h2>
            <JourneyRail steps={config.journey} busy={busy} />
          </div>
        )}

        {processing ? (
          <div className="flex justify-center py-4">
            <ImportProcessing
              phase={processing.phase}
              fileName={processing.fileName}
              copy={config.processing}
            />
          </div>
        ) : sheet ? (
          <SheetSelector
            prompt={config.copy.sheetPrompt}
            fileName={sheet.fileName ?? null}
            sheets={sheet.sheets}
            onSelect={sheet.onSelect}
          />
        ) : header ? (
          <HeaderSelector
            candidates={header.candidates}
            onSelect={header.onSelect}
          />
        ) : (
          <Dropzone
            state={drop}
            dropAreaLabel={config.copy.dropAreaLabel}
            onFile={onFile}
            onBrowse={() => inputRef.current?.click()}
            onRetry={onRetry}
            onRemove={onRemove}
          />
        )}

        <input
          ref={inputRef}
          aria-label={config.copy.fileInputLabel}
          className="sr-only"
          type="file"
          accept=".csv,.xlsx"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
            event.target.value = "";
          }}
        />
      </section>
    </PageContainer>
  );
}

/**
 * The dropzone's three-beat destination, shown as the section's wayfinding caption rather
 * than as prose. It answers "what happens after I add this file?" structurally: the first
 * beat is where you are (and pulses while Fusion reads the source); the rest are ahead.
 */
function JourneyRail({
  steps,
  busy,
}: {
  steps: [string, string, string];
  busy: boolean;
}) {
  return (
    <ol
      className="hidden items-center gap-1.5 type-meta sm:flex"
      aria-label="Import steps"
    >
      {steps.map((label, index) => {
        const active = index === 0;
        return (
          <li key={label} className="flex items-center gap-1.5">
            <span
              className={cn(
                "grid size-4 shrink-0 place-items-center rounded-full border text-[0.625rem] font-semibold tabular-nums",
                active
                  ? "border-primary text-primary"
                  : "border-border text-muted-foreground"
              )}
            >
              {index + 1}
            </span>
            <span
              className={
                active ? "font-medium text-foreground" : "text-muted-foreground"
              }
            >
              {label}
            </span>
            {active && busy ? (
              <span
                className="ml-0.5 size-1.5 animate-pulse rounded-full bg-primary motion-reduce:animate-none"
                aria-hidden
              />
            ) : null}
            {index < steps.length - 1 ? (
              <span className="mx-1 h-px w-4 bg-border" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * One drop surface for every pre-clarification state. The outer region keeps a constant
 * footprint (min height, centered stack, 2px border) so idle → reading → needs-a-fix change
 * *inside* it rather than swapping in a differently shaped card. Only the glyph, primary
 * line, action slot, and the reserved lower line change; geometry never does, so it never
 * jitters.
 */
function Dropzone({
  state,
  dropAreaLabel,
  onFile,
  onBrowse,
  onRetry,
  onRemove,
}: {
  state: OnrampDropState;
  dropAreaLabel: string;
  onFile: (file: File) => void;
  onBrowse: () => void;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const [dragActive, setDragActive] = useState(false);
  const idle = state.kind === "idle";
  const busy = state.kind === "busy";
  const rejected = state.kind === "rejected";
  const temporary = state.kind === "temporary";
  const fileName = state.kind === "idle" ? null : state.fileName;

  return (
    <div
      role="region"
      aria-label={dropAreaLabel}
      onDragEnter={(event: DragEvent<HTMLDivElement>) => {
        if (busy) return;
        event.preventDefault();
        setDragActive(true);
      }}
      onDragOver={(event: DragEvent<HTMLDivElement>) => event.preventDefault()}
      onDragLeave={() => setDragActive(false)}
      onDrop={(event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setDragActive(false);
        if (busy) return;
        const file = event.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
      className={cn(
        "grid min-h-64 place-items-center rounded-2xl border-2 px-6 py-8 text-center transition-colors duration-[var(--duration-normal)]",
        idle &&
          !dragActive &&
          "border-dashed border-border bg-foreground/[0.02] hover:border-border/70 hover:bg-foreground/[0.04]",
        busy && !dragActive && "border-primary/35 bg-primary/[0.03]",
        rejected &&
          !dragActive &&
          "border-destructive/40 bg-destructive/[0.03]",
        temporary && !dragActive && "border-warning/45 bg-warning/[0.04]",
        dragActive && "border-dashed border-primary bg-primary/[0.06]"
      )}
    >
      <div
        role={busy ? "status" : rejected || temporary ? "alert" : undefined}
        aria-live={busy ? "polite" : undefined}
        className="flex w-full max-w-sm flex-col items-center outline-none"
      >
        <span
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-xl transition-colors",
            (idle || busy) && "bg-primary/10 text-primary",
            busy && "ring-1 ring-primary/25",
            rejected && "bg-destructive/10 text-destructive",
            temporary && "bg-warning/10 text-warning"
          )}
        >
          {idle ? (
            <UploadCloud className="size-6" aria-hidden />
          ) : (
            <FileSpreadsheet className="size-6" aria-hidden />
          )}
        </span>

        <p className="mt-4 w-full truncate px-2 type-title font-semibold text-foreground">
          {idle
            ? dragActive
              ? "Drop to add your file"
              : "Drop your XLSX or CSV here"
            : fileName}
        </p>

        <div className="mt-5 flex min-h-9 items-center justify-center">
          {idle ? (
            <Button onClick={onBrowse}>Browse files</Button>
          ) : busy ? (
            <span className="flex items-center gap-2 type-meta text-primary">
              <Spinner className="size-4" aria-hidden />
              Reading your file…
            </span>
          ) : rejected ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={onBrowse}>
                Choose another file
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRemove}
                className="text-muted-foreground"
              >
                <Trash2 className="size-4" aria-hidden />
                Remove
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RotateCcw className="size-4" aria-hidden />
                Try again
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRemove}
                className="text-muted-foreground"
              >
                <Trash2 className="size-4" aria-hidden />
                Remove
              </Button>
            </div>
          )}
        </div>

        <div className="mt-4 min-h-4 max-w-xs type-meta">
          {idle ? (
            <p className="text-muted-foreground">
              XLSX · CSV · up to {MAX_SOURCE_BYTES / (1024 * 1024)} MB
            </p>
          ) : rejected ? (
            <p className="text-destructive">{state.message}</p>
          ) : temporary ? (
            <p className="text-muted-foreground">
              {state.message} Your file hasn’t been rejected.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SheetSelector({
  prompt,
  fileName,
  sheets,
  onSelect,
}: {
  prompt: string;
  fileName: string | null;
  sheets: OnrampSheetOption[];
  onSelect: (name: string) => void;
}) {
  const [selected, setSelected] = useState(sheets[0]?.name ?? "");
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="type-label font-medium text-foreground">{prompt}</p>
      {fileName ? (
        <p className="mt-0.5 type-meta text-muted-foreground">{fileName}</p>
      ) : null}
      <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border">
        {sheets.map((sheet) => (
          <li key={sheet.name}>
            <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/40">
              <input
                type="radio"
                name="import-sheet"
                checked={selected === sheet.name}
                onChange={() => setSelected(sheet.name)}
                className="size-4 accent-[var(--color-primary)]"
              />
              <span className="min-w-0 flex-1">
                <span className="block type-label font-medium text-foreground">
                  {sheet.name}
                </span>
                {sheet.rows != null && sheet.columns != null ? (
                  <span className="type-meta text-muted-foreground tabular-nums">
                    {sheet.rows} rows · {sheet.columns} columns
                  </span>
                ) : null}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <Button
        className="mt-4"
        onClick={() => onSelect(selected)}
        disabled={!selected}
      >
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
  candidates: OnrampHeaderCandidate[];
  onSelect: (rowIndex: number) => void;
}) {
  const [selected, setSelected] = useState(
    candidates.at(-1)?.rowIndex ?? candidates[0]?.rowIndex ?? 0
  );
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="type-label font-medium text-foreground">
        Which row contains the column names?
      </p>
      <ul className="mt-4 space-y-2">
        {candidates.map((candidate) => (
          <li key={candidate.rowIndex}>
            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors",
                selected === candidate.rowIndex
                  ? "border-primary/50 bg-primary/5"
                  : "border-border hover:bg-muted/40"
              )}
            >
              <input
                type="radio"
                name="import-header"
                checked={selected === candidate.rowIndex}
                onChange={() => setSelected(candidate.rowIndex)}
                className="mt-0.5 size-4 accent-[var(--color-primary)]"
              />
              <span className="min-w-0 flex-1 overflow-x-auto">
                <span className="type-meta text-muted-foreground">
                  Row {candidate.rowIndex + 1}
                </span>
                <span className="mt-1 flex gap-2 whitespace-nowrap type-code text-xs text-foreground">
                  {candidate.preview.map((cell, i) => (
                    <span key={i} className="text-muted-foreground/90">
                      {cell || "—"}
                      {i < candidate.preview.length - 1 ? (
                        <span className="ml-2 text-border">|</span>
                      ) : null}
                    </span>
                  ))}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <Button className="mt-4" onClick={() => onSelect(selected)}>
        Use this row
        <ArrowRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

/**
 * Discard from the list — the same destructive intent as discarding inside the session,
 * so it confirms first. Placed next to Resume, a bare click is too easy to fire by mistake;
 * the confirmation names the file being thrown away.
 */
function DiscardImportButton({
  fileName,
  onConfirm,
}: {
  fileName: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Trash2 className="size-4" aria-hidden />
          Discard
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard this import?</AlertDialogTitle>
          <AlertDialogDescription>
            The staged source “{fileName}” and its in-progress work will be
            removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep import</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Discard import
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Unfinished work is the consequential state on this surface, so it leads and is the one
 * element genuinely lifted above the page. One entry per in-progress import: the source
 * identity, its as-of date, and either establishment counts or a quiet recency line.
 */
function ResumeBand({ items }: { items: OnrampResumeItem[] }) {
  return (
    <section aria-labelledby="import-onramp-resume" className="space-y-3">
      <h2
        id="import-onramp-resume"
        className="type-label font-semibold text-foreground"
      >
        {items.length === 1 ? "Import in progress" : "Imports in progress"}
      </h2>
      <div className="space-y-2.5">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-raised"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FileSpreadsheet
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <p className="truncate type-label font-semibold text-foreground">
                  {item.fileName}
                </p>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 type-meta text-muted-foreground">
                <span>As of {item.asOfLabel}</span>
                {item.counts ? (
                  <>
                    <span aria-hidden className="text-border">
                      ·
                    </span>
                    <span>
                      <span className="font-semibold text-foreground tabular-nums">
                        {item.counts.newCount}
                      </span>{" "}
                      new
                    </span>
                    <span aria-hidden className="text-border">
                      ·
                    </span>
                    <span>
                      <span className="font-semibold text-foreground tabular-nums">
                        {item.counts.existingCount}
                      </span>{" "}
                      existing
                    </span>
                    {item.counts.needsAttention > 0 ? (
                      <StatusBadge tone="warning" dot>
                        {item.counts.needsAttention} to decide
                      </StatusBadge>
                    ) : null}
                  </>
                ) : item.metaLine ? (
                  <>
                    <span aria-hidden className="text-border">
                      ·
                    </span>
                    <span>{item.metaLine}</span>
                  </>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {item.href ? (
                <Button asChild size="sm">
                  <Link href={item.href}>
                    Resume
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
              ) : (
                <Button size="sm" onClick={item.onResume}>
                  Continue import
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
              )}
              {item.onDiscard ? (
                <DiscardImportButton
                  fileName={item.fileName}
                  onConfirm={item.onDiscard}
                />
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
