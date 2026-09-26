"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  Button,
  DatePicker,
  Label,
  RadioGroup,
  RadioGroupItem,
  Spinner,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  cn,
} from "@repo/ds";
import { PageContainer } from "@repo/ds/shell";
import { ArrowRight, ChevronRight, Clock, Download, FileSpreadsheet, FileText, Info, RotateCcw, Upload } from "lucide-react";
import { formatRelativeTime } from "@/features/organization-import/model/format";
import { ImportHeader } from "./import-header";
import { checkLocalSource, formatFileSize, formatModified, sourceKind, type UploadProblem } from "../model/upload-source";

export type UploadHeaderCandidate = { rowIndex: number; preview: Array<string | null> };

/** What intake concluded about one source: an attempt to open, or one more intake question. */
export type UploadIntakeResult =
  | { kind: "ready"; href: string }
  | { kind: "sheet"; sheets: string[] }
  | { kind: "header"; candidates: UploadHeaderCandidate[]; choose: (rowIndex: number) => Promise<string> };

export type UploadResume = { fileName: string; savedAt: string; href: string };

/** The domain adapter: everything that differs between Organization and Workforce Upload. */
export type ImportUploadProps = {
  title: string;
  context: string;
  /** "organization", "workforce": completes "Drop your … file here". */
  fileNoun: string;
  sectionTitle: string;
  sectionDescription: string;
  date: {
    label: string;
    tooltip: string;
    initial: string;
    /** A reason the date can't be used, or null. */
    validate: (value: string) => string | null;
  };
  cancelHref: string;
  onDownloadTemplate: () => void;
  /** Extra line under the template card (e.g. Org's "Export current structure"), given the chosen date. */
  templateExtra?: (date: string) => ReactNode;
  resume: UploadResume | null;
  intake: (input: { file: File; token: string; date: string; sheet?: string }) => Promise<UploadIntakeResult>;
  classifyError: (error: unknown) => UploadProblem;
};

/**
 * What Upload is doing with the one source in hand. There is no import attempt until intake
 * succeeds, so everything before "handoff" is local and abandoned by leaving.
 */
type Source =
  | { kind: "none" }
  | { kind: "selected"; file: File; token: string }
  | { kind: "sheet"; file: File; token: string; sheets: string[]; sheet: string }
  | {
      kind: "header";
      file: File;
      token: string;
      candidates: UploadHeaderCandidate[];
      rowIndex: number;
      choose: (rowIndex: number) => Promise<string>;
    }
  | { kind: "submitting"; file: File; token: string; sheet?: string }
  | { kind: "failed"; file: File; token: string; sheet?: string; problem: UploadProblem }
  | { kind: "handoff"; file: File };

/**
 * Handoff rhythm. A fast intake still shows a perceptible, calm processing beat instead of a
 * flicker, and success settles before the route moves. Mutable so tests can neutralise the beats.
 */
export const uploadHandoffTiming = { minProcessingMs: 900, settleMs: 650 };

const wait = (ms: number) => (ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve());

/**
 * Upload: the intake boundary shared by every import. It establishes one trustworthy source
 * and an explicit as-of date, creates the attempt, and hands it to the attempt's own resolver.
 * Sheet and header-row questions are answered inline; they are never stages.
 */
export function ImportUpload(props: ImportUploadProps) {
  const { title, context, fileNoun, sectionTitle, sectionDescription, date, cancelHref, resume } = props;
  const router = useRouter();
  const inputId = useId();
  const dateId = useId();
  const [value, setValue] = useState(date.initial);
  const [source, setSource] = useState<Source>({ kind: "none" });
  const inputRef = useRef<HTMLInputElement>(null);
  // The attempt about to be created must not flash into Resume before the handoff lands.
  const [heldResume, setHeldResume] = useState<UploadResume | null>(null);

  const busy = source.kind === "submitting" || source.kind === "handoff";
  const latest = busy ? heldResume : resume;
  const dateProblem = date.validate(value);
  const canStart =
    !dateProblem &&
    (source.kind === "selected" ||
      source.kind === "sheet" ||
      source.kind === "header" ||
      (source.kind === "failed" && source.problem.retryable));

  function choose(file: File | undefined) {
    if (!file || busy) return;
    // A different file is a different source: it gets its own creation token.
    const token = crypto.randomUUID();
    const problem = checkLocalSource(file);
    setSource(problem ? { kind: "failed", file, token, problem } : { kind: "selected", file, token });
  }

  async function handoff(file: File, href: string, startedAt: number) {
    await wait(uploadHandoffTiming.minProcessingMs - (Date.now() - startedAt));
    setSource({ kind: "handoff", file });
    await wait(uploadHandoffTiming.settleMs);
    router.replace(href);
  }

  async function start() {
    if (!canStart) return;
    const { file, token } = source;
    const sheet = source.kind === "sheet" ? source.sheet : source.kind === "failed" ? source.sheet : undefined;
    setHeldResume(resume);
    const startedAt = Date.now();
    if (source.kind === "header") {
      const { rowIndex, choose: chooseHeader } = source;
      setSource({ kind: "submitting", file, token });
      try {
        await handoff(file, await chooseHeader(rowIndex), startedAt);
      } catch (error) {
        setSource({ kind: "failed", file, token: crypto.randomUUID(), problem: props.classifyError(error) });
      }
      return;
    }
    setSource({ kind: "submitting", file, token, sheet });
    try {
      const result = await props.intake({ file, token, date: value, sheet });
      if (result.kind === "sheet") {
        setSource({ kind: "sheet", file, token, sheets: result.sheets, sheet: result.sheets[0] ?? "" });
        return;
      }
      if (result.kind === "header") {
        setSource({ kind: "header", file, token, candidates: result.candidates, rowIndex: result.candidates[0]?.rowIndex ?? 0, choose: result.choose });
        return;
      }
      await handoff(file, result.href, startedAt);
    } catch (error) {
      const problem = props.classifyError(error);
      // A conflicting token can never succeed again; the next attempt needs a fresh one.
      const nextToken = problem.category === "SourceConflict" ? crypto.randomUUID() : token;
      setSource({ kind: "failed", file, token: nextToken, sheet, problem });
    }
  }

  const retrying = source.kind === "failed" && source.problem.retryable;
  const handedOff = source.kind === "handoff";

  return (
    <PageContainer className="space-y-8 pb-16">
      <ImportHeader
        title={title}
        context={context}
        steps={[
          { key: "upload", label: "Upload", state: handedOff ? "done" : "current" },
          { key: "match", label: "Match", state: handedOff ? "current" : "upcoming" },
          { key: "review", label: "Review", state: "upcoming" },
        ]}
      />

      <section aria-labelledby={`${inputId}-title`} className="rounded-surface border border-border bg-card p-5 shadow-raised sm:p-8">
        <h2 id={`${inputId}-title`} className="type-page-title text-foreground">
          {sectionTitle}
        </h2>
        <p className="mt-1 type-body text-muted-foreground">{sectionDescription}</p>

        <div className="mt-6">
          <SourceField source={source} fileNoun={fileNoun} disabled={busy} onFile={choose} onBrowse={() => inputRef.current?.click()} />
          <input
            ref={inputRef}
            id={inputId}
            aria-label={`Choose ${/^[aeiou]/i.test(fileNoun) ? "an" : "a"} ${fileNoun} source file`}
            aria-describedby={`${inputId}-formats`}
            className="sr-only"
            type="file"
            accept=".xlsx,.csv"
            tabIndex={-1}
            onChange={(event) => {
              choose(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <p id={`${inputId}-formats`} className="mt-3 flex items-center gap-2 type-meta text-muted-foreground">
            <Info className="size-3.5 shrink-0" aria-hidden />
            <span>
              XLSX, CSV <span aria-hidden>·</span> one sheet per import attempt
            </span>
          </p>
        </div>

        {source.kind === "sheet" ? (
          <SheetChoice fileNoun={fileNoun} sheets={source.sheets} value={source.sheet} onChange={(sheet) => setSource({ ...source, sheet })} />
        ) : null}
        {source.kind === "header" ? (
          <HeaderChoice candidates={source.candidates} value={source.rowIndex} onChange={(rowIndex) => setSource({ ...source, rowIndex })} />
        ) : null}

        <div className="mt-7 space-y-2">
          <div className="flex items-center gap-1.5">
            <Label htmlFor={dateId} className="type-label text-foreground">
              {date.label}
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`About ${date.label.toLowerCase()}`}
                    className="grid size-5 place-items-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Info className="size-3.5" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{date.tooltip}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <DatePicker
              id={dateId}
              value={value}
              onChange={setValue}
              disabled={busy || source.kind === "header"}
              className="h-11 min-w-56 flex-1 basis-64 rounded-object px-3 type-body text-foreground sm:max-w-md"
            />
            <div className="ml-auto flex items-center gap-3">
              <Button
                size="lg"
                className={cn("h-11 gap-2 px-5 text-base font-semibold", busy && "disabled:opacity-100")}
                disabled={!canStart || busy}
                aria-busy={busy || undefined}
                onClick={() => void start()}
              >
                {busy ? (
                  <>
                    <Spinner className="size-4" aria-hidden />
                    Starting import
                  </>
                ) : retrying ? (
                  <>
                    <RotateCcw className="size-4" aria-hidden />
                    Try again
                  </>
                ) : (
                  <>
                    Start import
                    <ChevronRight className="size-4" aria-hidden />
                  </>
                )}
              </Button>
              <Button asChild variant="ghost" size="lg" className="h-11 px-4 text-base text-muted-foreground">
                <Link href={cancelHref}>Cancel</Link>
              </Button>
            </div>
          </div>
          {dateProblem ? (
            <p role="alert" className="type-meta text-destructive">
              {dateProblem}
            </p>
          ) : null}
        </div>
      </section>

      <div className={cn("grid gap-4", latest && "md:grid-cols-2")}>
        <SideAction
          icon={<Download className="size-5" aria-hidden />}
          title="Download Fusion template"
          description="Prefer the standard format? Start from our template."
          action={
            <ActionButton onClick={props.onDownloadTemplate} aria-label="Download Fusion template">
              Download
            </ActionButton>
          }
          extra={props.templateExtra?.(value)}
        />
        {latest ? (
          <SideAction
            icon={<Clock className="size-5" aria-hidden />}
            title="Resume previous attempt"
            description={
              <>
                Saved {formatRelativeTime(latest.savedAt)}
                <span aria-hidden> · </span>
                <span className="break-all">{latest.fileName}</span>
              </>
            }
            action={
              <ActionButton asChild>
                <Link href={latest.href} aria-label={`Resume ${latest.fileName}`}>
                  Resume
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </ActionButton>
            }
          />
        ) : null}
      </div>
    </PageContainer>
  );
}

/**
 * The single source object: an empty drop target until a file is chosen, then the file itself
 * with Replace. Its footprint stays constant across empty, chosen, reading and needs-a-fix.
 */
function SourceField({
  source,
  fileNoun,
  disabled,
  onFile,
  onBrowse,
}: {
  source: Source;
  fileNoun: string;
  disabled: boolean;
  onFile: (file: File | undefined) => void;
  onBrowse: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const messageId = useId();
  const dropHandlers = {
    onDragEnter: (event: DragEvent) => {
      if (disabled) return;
      event.preventDefault();
      setDragging(true);
    },
    onDragOver: (event: DragEvent) => event.preventDefault(),
    onDragLeave: () => setDragging(false),
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      setDragging(false);
      if (!disabled) onFile(event.dataTransfer.files?.[0]);
    },
  };
  const noun = fileNoun.charAt(0).toUpperCase() + fileNoun.slice(1);

  if (source.kind === "none") {
    return (
      <div
        role="region"
        aria-label={`${noun} source drop area`}
        {...dropHandlers}
        className={cn(
          "flex min-h-24 flex-wrap items-center justify-between gap-4 rounded-object border border-dashed px-5 py-4 transition-colors duration-[var(--duration-normal)]",
          dragging ? "border-primary bg-primary/[0.06]" : "border-border bg-foreground/[0.02]"
        )}
      >
        <div className="flex min-w-0 flex-1 basis-60 items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-object bg-primary/15 text-primary-foreground ring-1 ring-primary/25 dark:text-primary">
            <Upload className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="type-panel-title font-semibold text-foreground">
              {dragging ? "Drop to add your file" : `Drop your ${fileNoun} file here`}
            </p>
            <p className="mt-1 type-meta text-muted-foreground">Or choose it from your computer</p>
          </div>
        </div>
        <Button variant="outline" size="lg" className="h-10 gap-2 px-4" onClick={onBrowse}>
          <Upload className="size-4" aria-hidden />
          Choose file
        </Button>
      </div>
    );
  }

  const file = source.file;
  const kind = sourceKind(file.name);
  const failed = source.kind === "failed" ? source.problem : null;
  const modified = formatModified(file.lastModified);
  const reading = source.kind === "submitting" || source.kind === "handoff";

  return (
    <div
      role="group"
      aria-label={`${noun} source`}
      {...dropHandlers}
      className={cn(
        "relative flex min-h-24 flex-wrap items-center justify-between gap-4 overflow-hidden rounded-object border px-5 py-4 transition-colors duration-[var(--duration-normal)]",
        reading && "pb-7",
        dragging
          ? "border-dashed border-primary bg-primary/[0.06]"
          : failed && !failed.retryable
            ? "border-destructive/45 bg-destructive/[0.03]"
            : failed
              ? "border-warning/50 bg-warning/[0.04]"
              : "border-border bg-background/40"
      )}
    >
      <div className="flex min-w-0 flex-1 basis-60 items-center gap-4">
        <span
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-object",
            failed && !failed.retryable
              ? "bg-destructive/10 text-destructive"
              : kind === "xlsx"
                ? "bg-success-subtle text-success"
                : "bg-muted text-muted-foreground"
          )}
        >
          {kind === "csv" ? <FileText className="size-6" aria-hidden /> : <FileSpreadsheet className="size-6" aria-hidden />}
        </span>
        <div className="min-w-0">
          <p className="truncate type-panel-title font-semibold text-foreground">{file.name}</p>
          <div id={messageId} className="mt-1 type-meta" role={failed ? "alert" : "status"} aria-live="polite">
            {reading ? (
              <span className="flex items-center gap-2 text-foreground">
                <Spinner className="size-3.5" aria-hidden />
                {source.kind === "handoff" ? "Opening your import…" : "Reading your file…"}
              </span>
            ) : failed ? (
              <span className={failed.retryable ? "text-foreground" : "text-destructive"}>{failed.message}</span>
            ) : (
              <span className="text-muted-foreground">
                {formatFileSize(file.size)}
                {modified ? (
                  <>
                    <span aria-hidden className="mx-1.5">
                      ·
                    </span>
                    {modified}
                  </>
                ) : null}
              </span>
            )}
          </div>
        </div>
      </div>
      <Button
        variant="outline"
        size="lg"
        className="h-10 gap-2 px-4"
        disabled={disabled || source.kind === "header"}
        aria-describedby={failed ? messageId : undefined}
        onClick={onBrowse}
      >
        <Upload className="size-4" aria-hidden />
        {failed && !failed.retryable ? "Choose another file" : "Replace file"}
      </Button>
      {reading ? <IntakeProgress complete={source.kind === "handoff"} /> : null}
    </div>
  );
}

/** Only when a workbook holds several data sheets and none is plainly the one. Never a stage of its own. */
function SheetChoice({ fileNoun, sheets, value, onChange }: { fileNoun: string; sheets: string[]; value: string; onChange: (sheet: string) => void }) {
  return (
    <fieldset className="mt-5 rounded-object border border-border p-5">
      <legend className="sr-only">Sheet to import</legend>
      <p className="type-label font-semibold text-foreground">This workbook contains several data sheets.</p>
      <p className="mt-1 type-meta text-muted-foreground">Choose the {fileNoun} data to import.</p>
      <RadioGroup value={value} onValueChange={onChange} className="mt-4 gap-2">
        {sheets.map((sheet) => (
          <label
            key={sheet}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-object border px-4 py-3 transition-colors",
              value === sheet ? "border-primary/60 bg-primary/[0.05]" : "border-border hover:bg-muted/40"
            )}
          >
            <RadioGroupItem value={sheet} aria-label={sheet} />
            <span className="type-label font-medium text-foreground">{sheet}</span>
          </label>
        ))}
      </RadioGroup>
    </fieldset>
  );
}

/** Only when title rows sit above the headers and more than one row could be them. Same grammar as the sheet choice. */
function HeaderChoice({ candidates, value, onChange }: { candidates: UploadHeaderCandidate[]; value: number; onChange: (rowIndex: number) => void }) {
  return (
    <fieldset className="mt-5 rounded-object border border-border p-5">
      <legend className="sr-only">Header row</legend>
      <p className="type-label font-semibold text-foreground">Which row holds the column names?</p>
      <RadioGroup value={String(value)} onValueChange={(v) => onChange(Number(v))} className="mt-4 gap-2">
        {candidates.map((candidate) => {
          const cells = candidate.preview.filter((cell): cell is string => Boolean(cell?.trim()));
          return (
            <label
              key={candidate.rowIndex}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-object border px-4 py-3 transition-colors",
                value === candidate.rowIndex ? "border-primary/60 bg-primary/[0.05]" : "border-border hover:bg-muted/40"
              )}
            >
              <RadioGroupItem value={String(candidate.rowIndex)} aria-label={`Row ${candidate.rowIndex + 1}`} />
              <span className="shrink-0 type-meta tabular-nums text-muted-foreground">Row {candidate.rowIndex + 1}</span>
              <span className="truncate type-label font-medium text-foreground">{cells.join(" · ")}</span>
            </label>
          );
        })}
      </RadioGroup>
    </fieldset>
  );
}

function SideAction({
  icon,
  title,
  description,
  action,
  extra,
}: {
  icon: ReactNode;
  title: string;
  description: ReactNode;
  action: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-surface border border-border bg-card px-5 py-5">
      <span className="grid size-12 shrink-0 place-items-center rounded-object bg-muted text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="type-label font-semibold text-foreground">{title}</p>
        <p className="mt-1.5 type-meta text-muted-foreground">{description}</p>
        {extra}
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

/** Quiet text action in the brand accent, legible on both themes. */
export function ActionButton(props: React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="ghost"
      {...props}
      className={cn(
        "h-9 gap-1.5 px-3 font-semibold text-primary-foreground hover:bg-primary/10 hover:text-primary-foreground dark:text-primary dark:hover:text-primary",
        props.className
      )}
    />
  );
}

/**
 * Intake progress inside the file row. The request reports no real progress, so the bar advances
 * towards 90% while Fusion reads the file and only completes when the attempt exists.
 */
function IntakeProgress({ complete }: { complete: boolean }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (complete) {
      setValue(100);
      return;
    }
    const timer = setInterval(() => setValue((current) => current + (90 - current) * 0.08), 120);
    return () => clearInterval(timer);
  }, [complete]);
  return (
    <div
      role="progressbar"
      aria-label="Starting import"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      className="absolute inset-x-5 bottom-2.5 h-1.5 overflow-hidden rounded-full bg-muted"
    >
      <div
        className={cn(
          "h-full rounded-full bg-primary ease-out motion-reduce:transition-none",
          complete ? "transition-[width] duration-500" : "transition-[width] duration-150"
        )}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
