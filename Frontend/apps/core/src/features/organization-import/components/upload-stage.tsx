"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type DragEvent } from "react";
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
import {
  translateOrganizationImportError,
  type OrganizationImportActiveSummaryDto,
} from "@repo/api";
import {
  ArrowRight,
  ChevronRight,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  RotateCcw,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { todayCalendarDate } from "@/features/organization/model/workspace-state";
import { useOrganizationReadiness } from "@/features/organization/api/use-organization";
import { downloadBlob, formatRelativeTime } from "../model/format";
import {
  checkLocalSource,
  classifyIntakeProblem,
  formatFileSize,
  formatModified,
  isValidEffectiveDate,
  sourceKind,
  type UploadProblem,
} from "../model/upload-source";
import {
  useActiveOrganizationImports,
  useOrganizationImportApi,
  useOrganizationImportMutations,
} from "../api/use-organization-import";
import { importStageHref } from "../model/import-stage";
import { ImportHeader } from "./import-header";

/**
 * What Upload is doing with the one source in hand. There is no import attempt until
 * intake succeeds, so everything before "handoff" is local and abandoned by leaving.
 */
type Source =
  | { kind: "none" }
  | { kind: "selected"; file: File; token: string }
  | { kind: "sheet"; file: File; token: string; sheets: string[]; sheet: string }
  | { kind: "submitting"; file: File; token: string; sheet?: string }
  | { kind: "failed"; file: File; token: string; sheet?: string; problem: UploadProblem }
  | { kind: "handoff"; file: File };

/**
 * Handoff rhythm. A fast intake still shows a perceptible, calm processing beat instead of a
 * flicker, and success settles (bar fills, Upload turns into a check) before the route moves.
 * Mutable so tests can neutralise the beats.
 */
export const uploadHandoffTiming = { minProcessingMs: 900, settleMs: 650 };

const wait = (ms: number) => (ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve());

const INPUT_ID = "organization-import-source";
const DATE_ID = "organization-import-date";

/**
 * Upload: the intake boundary of an Organization import. It establishes one trustworthy
 * source and an explicit effective date, creates the attempt, and hands it to the attempt
 * resolver, which alone decides between Match and Review.
 */
export function UploadStage() {
  const router = useRouter();
  const api = useOrganizationImportApi();
  const { intake } = useOrganizationImportMutations();
  const active = useActiveOrganizationImports();
  const readiness = useOrganizationReadiness();
  const [effectiveDate, setEffectiveDate] = useState(() => todayCalendarDate());
  const [source, setSource] = useState<Source>({ kind: "none" });
  const inputRef = useRef<HTMLInputElement>(null);
  // The attempt about to be created must not flash into Resume before the handoff lands.
  const [heldLatest, setHeldLatest] = useState<OrganizationImportActiveSummaryDto | null>(null);

  const busy = source.kind === "submitting" || source.kind === "handoff";
  const latest = busy ? heldLatest : (active.data?.[0] ?? null);
  const dateValid = isValidEffectiveDate(effectiveDate);
  const canStart =
    dateValid &&
    (source.kind === "selected" ||
      source.kind === "sheet" ||
      (source.kind === "failed" && source.problem.retryable));

  function choose(file: File | undefined) {
    if (!file || busy) return;
    // A different file is a different source: it gets its own creation token.
    const token = crypto.randomUUID();
    const problem = checkLocalSource(file);
    setSource(problem ? { kind: "failed", file, token, problem } : { kind: "selected", file, token });
  }

  async function start() {
    if (!canStart) return;
    const { file, token } = source;
    const sheet = source.kind === "selected" ? undefined : source.sheet;
    setHeldLatest(active.data?.[0] ?? null);
    setSource({ kind: "submitting", file, token, sheet });
    const startedAt = Date.now();
    try {
      const result = await intake.mutateAsync({
        file,
        creationToken: token,
        effectiveDate,
        selectedSheetName: sheet,
      });
      if (result.kind === "SheetSelectionRequired") {
        const sheets = result.sheetSelection.candidateSheetNames;
        setSource({ kind: "sheet", file, token, sheets, sheet: sheets[0] ?? "" });
        return;
      }
      await wait(uploadHandoffTiming.minProcessingMs - (Date.now() - startedAt));
      setSource({ kind: "handoff", file });
      await wait(uploadHandoffTiming.settleMs);
      // A new upload always lands on Match, even when Fusion (or AI) matched everything: the
      // administrator sees what was understood before moving on. Resume uses the stage resolver.
      router.replace(importStageHref(result.session.id, "match"));
    } catch (error) {
      const problem = classifyIntakeProblem(translateOrganizationImportError(error));
      // A conflicting token can never succeed again; the next attempt needs a fresh one.
      const nextToken = problem.category === "SourceConflict" ? crypto.randomUUID() : token;
      setSource({ kind: "failed", file, token: nextToken, sheet, problem });
    }
  }

  async function download(kind: "template" | "export") {
    try {
      const blob =
        kind === "template" ? await api.downloadTemplate() : await api.exportStructure(effectiveDate);
      downloadBlob(
        blob,
        kind === "template" ? "Fusion-organization-template.xlsx" : `Fusion-organization-${effectiveDate}.xlsx`
      );
    } catch (error) {
      toast.error(kind === "template" ? "Template could not be downloaded" : "Structure could not be exported", {
        description: translateOrganizationImportError(error).message,
      });
    }
  }

  const retrying = source.kind === "failed" && source.problem.retryable;
  const handedOff = source.kind === "handoff";

  return (
    <PageContainer className="space-y-8 pb-16">
      <ImportHeader
        context="Bring in your structure from Excel or CSV and review it before publishing."
        steps={[
          { key: "upload", label: "Upload", state: handedOff ? "done" : "current" },
          { key: "match", label: "Match", state: handedOff ? "current" : "upcoming" },
          { key: "review", label: "Review", state: "upcoming" },
        ]}
      />

      <section
        aria-labelledby="upload-source-title"
        className="rounded-surface border border-border bg-card p-5 shadow-raised sm:p-8"
      >
        <h2 id="upload-source-title" className="type-page-title text-foreground">
          File and effective date
        </h2>
        <p className="mt-1 type-body text-muted-foreground">
          Select your organization file and choose when the changes should take effect.
        </p>

        <div className="mt-6">
          <SourceField
            source={source}
            disabled={busy}
            onFile={choose}
            onBrowse={() => inputRef.current?.click()}
          />
          <input
            ref={inputRef}
            id={INPUT_ID}
            aria-label="Choose an organization source file"
            aria-describedby="upload-source-formats"
            className="sr-only"
            type="file"
            accept=".xlsx,.csv"
            tabIndex={-1}
            onChange={(event) => {
              choose(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <p
            id="upload-source-formats"
            className="mt-3 flex items-center gap-2 type-meta text-muted-foreground"
          >
            <Info className="size-3.5 shrink-0" aria-hidden />
            <span>
              XLSX, CSV <span aria-hidden>·</span> one sheet per import attempt
            </span>
          </p>
        </div>

        {source.kind === "sheet" ? (
          <SheetChoice
            sheets={source.sheets}
            value={source.sheet}
            onChange={(sheet) => setSource({ ...source, sheet })}
          />
        ) : null}

        <div className="mt-7 space-y-2">
          <div className="flex items-center gap-1.5">
            <Label htmlFor={DATE_ID} className="type-label text-foreground">
              Effective date
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="About the effective date"
                    className="grid size-5 place-items-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Info className="size-3.5" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Changes will be staged with this effective date.</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <DatePicker
              id={DATE_ID}
              value={effectiveDate}
              onChange={setEffectiveDate}
              disabled={busy}
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
                <Link href="/organization">Cancel</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className={cn("grid gap-4", latest && "md:grid-cols-2")}>
        <SideAction
          icon={<Download className="size-5" aria-hidden />}
          title="Download Fusion template"
          description="Prefer the standard format? Start from our template."
          action={
            <ActionButton onClick={() => void download("template")} aria-label="Download Fusion template">
              Download
            </ActionButton>
          }
          extra={
            readiness.data?.hasPermanentRoot ? (
              <button
                type="button"
                onClick={() => void download("export")}
                className="mt-1 rounded-sm type-meta text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                Export current structure
              </button>
            ) : null
          }
        />
        {latest ? (
          <SideAction
            icon={<Clock className="size-5" aria-hidden />}
            title="Resume previous attempt"
            description={
              <>
                Saved {formatRelativeTime(latest.updatedAt ?? latest.createdAt)}
                <span aria-hidden> · </span>
                <span className="break-all">{latest.originalFileName}</span>
              </>
            }
            action={
              <ActionButton asChild>
                <Link href={`/organization/import/${latest.id}`} aria-label={`Resume ${latest.originalFileName}`}>
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
 * The single source object: an empty drop target until a file is chosen, then the file
 * itself with Replace. Its footprint stays constant across empty, chosen, reading and
 * needs-a-fix, so the card never jumps.
 */
function SourceField({
  source,
  disabled,
  onFile,
  onBrowse,
}: {
  source: Source;
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

  if (source.kind === "none") {
    return (
      <div
        role="region"
        aria-label="Organization source drop area"
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
              {dragging ? "Drop to add your file" : "Drop your organization file here"}
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
      aria-label="Organization source"
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
          {kind === "csv" ? (
            <FileText className="size-6" aria-hidden />
          ) : (
            <FileSpreadsheet className="size-6" aria-hidden />
          )}
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
              <span className={failed.retryable ? "text-foreground" : "text-destructive"}>
                {failed.message}
              </span>
            ) : (
              <span className="text-muted-foreground">
                {formatFileSize(file.size)}
                {modified ? (
                  <>
                    <span aria-hidden className="mx-1.5">·</span>
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
        disabled={disabled}
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

/**
 * Only when a workbook holds several data sheets and none is plainly the organization.
 * It is a subordinate intake question inside Upload, never a stage of its own.
 */
function SheetChoice({
  sheets,
  value,
  onChange,
}: {
  sheets: string[];
  value: string;
  onChange: (sheet: string) => void;
}) {
  return (
    <fieldset className="mt-5 rounded-object border border-border p-5">
      <legend className="sr-only">Sheet to import</legend>
      <p className="type-label font-semibold text-foreground">This workbook contains several data sheets.</p>
      <p className="mt-1 type-meta text-muted-foreground">Choose the organization data to import.</p>
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

function SideAction({
  icon,
  title,
  description,
  action,
  extra,
}: {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  action: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-surface border border-border bg-card px-5 py-5">
      <span className="grid size-12 shrink-0 place-items-center rounded-object bg-muted text-muted-foreground">
        {icon}
      </span>
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
function ActionButton(props: React.ComponentProps<typeof Button>) {
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
 * Intake progress inside the file row, just above its bottom edge. The request reports no real progress, so the
 * bar advances continuously towards 90% (fast at first, then slowing) while Fusion reads the
 * file, and only completes when the attempt exists: it never claims to be done before it is.
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
  const rounded = Math.round(value);
  return (
    <div
      role="progressbar"
      aria-label="Starting import"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={rounded}
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
