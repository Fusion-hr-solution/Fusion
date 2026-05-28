"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  FileSpreadsheet,
  LoaderCircle,
  Upload,
} from "lucide-react";
import {
  ApiError,
  type DraftStructureImportApplyResultDto,
  type DraftStructureImportStage,
} from "@repo/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DraftStructureTree } from "./draft-structure-tree";
import {
  buildImportPreviewDraftTree,
  findDraftTreeNodeById,
  getFirstDraftTreeNodeId,
} from "./draft-structure-tree-utils";
import {
  useApplyDraftStructureImport,
  useDownloadDraftStructureTemplate,
  useDraftStructureImportSchema,
  useDraftStructureImportSession,
  useUploadDraftStructureImport,
  useValidateDraftStructureImport,
} from "./use-draft-structure";
import { getImportFieldLabel } from "./draft-structure-labels";

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

function getImportProgressSummary({
  stage,
  canValidate,
  canApply,
  errorCount,
}: {
  stage: DraftStructureImportStage;
  canValidate: boolean;
  canApply: boolean;
  errorCount: number;
}) {
  if (stage === "Expired") {
    return {
      label: "Review expired",
      hint: "Upload again.",
      tone: "destructive" as const,
    };
  }

  if (stage === "Applied") {
    return {
      label: "Draft updated",
      hint: "This file already replaced the draft.",
      tone: "secondary" as const,
    };
  }

  if (canApply) {
    return {
      label: "Ready to replace draft",
      hint: "The review is clean.",
      tone: "secondary" as const,
    };
  }

  if (stage === "Validated" && errorCount > 0) {
    return {
      label: "Fix the file",
      hint: "Fix it, then upload again.",
      tone: "destructive" as const,
    };
  }

  if (canValidate) {
    return {
      label: "Ready to validate",
      hint: "Validate to build the preview.",
      tone: "default" as const,
    };
  }

  return {
    label: "File uploaded",
    hint: "Validate to continue.",
    tone: "default" as const,
  };
}

const stageTones: Record<string, string> = {
  destructive: "border-destructive/30 bg-destructive/5",
  secondary:
    "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30",
  default: "",
};

function DropZone({
  onFileSelected,
  disabled,
}: {
  onFileSelected: (file: File) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith(".csv")) {
      onFileSelected(file);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
        disabled
          ? "cursor-not-allowed opacity-50"
          : dragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-full border bg-background text-muted-foreground">
        <Upload className="size-4" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">Choose template file</p>
        <p className="text-sm text-muted-foreground">
          Drag and drop or click to browse CSV files.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        disabled={disabled}
        onChange={handleChange}
      />
    </div>
  );
}

export function DraftStructureImportPanel({
  open,
  onOpenChange,
  sessionId,
  onSessionIdChange,
  onApplied,
  readOnly = false,
  readOnlyTitle = "Import is unavailable",
  readOnlyMessage = "This draft is read-only.",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string | null;
  onSessionIdChange: (sessionId: string | null) => void;
  onApplied?: (
    result: DraftStructureImportApplyResultDto
  ) => void | Promise<void>;
  readOnly?: boolean;
  readOnlyTitle?: string;
  readOnlyMessage?: string;
}) {
  const [pendingFileName, setPendingFileName] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [selectedPreviewNodeId, setSelectedPreviewNodeId] = useState<
    string | null
  >(null);

  const {
    data: session,
    error: sessionError,
    isLoading: isSessionLoading,
  } = useDraftStructureImportSession(sessionId, open && !!sessionId);
  const { data: importSchema } = useDraftStructureImportSchema(open);
  const uploadImport = useUploadDraftStructureImport();
  const downloadTemplate = useDownloadDraftStructureTemplate();
  const validateImport = useValidateDraftStructureImport();
  const applyImport = useApplyDraftStructureImport();
  const activeSession = sessionId ? (session ?? null) : null;
  const isAutoReviewInProgress =
    uploadImport.isLoading || validateImport.isLoading;
  const isProcessingSelectedFile = !!pendingFileName && isAutoReviewInProgress;
  const hasRenderablePanelState =
    !!pageError || !!sessionError || !!importSchema || !!activeSession;
  const isInitialPanelLoading =
    open && !hasRenderablePanelState && (!sessionId || isSessionLoading);

  const previewTree = useMemo(
    () =>
      buildImportPreviewDraftTree(
        activeSession?.previewRows ?? [],
        activeSession?.validationIssues ?? []
      ),
    [activeSession?.previewRows, activeSession?.validationIssues]
  );
  const importProgress = activeSession
    ? getImportProgressSummary({
        stage: activeSession.stage,
        canValidate: activeSession.canValidate,
        canApply: activeSession.canApply,
        errorCount: activeSession.validationSummary.errorCount,
      })
    : null;
  const currentUnitTypes = useMemo(
    () =>
      activeSession?.importSchema.draftStructureSchema.orgUnitKinds ??
      importSchema?.draftStructureSchema.orgUnitKinds ??
      [],
    [
      activeSession?.importSchema.draftStructureSchema.orgUnitKinds,
      importSchema?.draftStructureSchema.orgUnitKinds,
    ]
  );
  const newKindResolutions = useMemo(
    () =>
      activeSession?.kindResolutions.filter(
        (resolution) => resolution.createNewKind
      ) ?? [],
    [activeSession?.kindResolutions]
  );
  const sessionUnitTypes = useMemo(() => {
    const mergedKinds = [...currentUnitTypes];
    const seenKindKeys = new Set(currentUnitTypes.map((kind) => kind.key));

    for (const resolution of newKindResolutions) {
      const key =
        resolution.resolvedOrgUnitKindKey ?? resolution.suggestedOrgUnitKindKey;
      const displayLabel =
        resolution.resolvedDisplayLabel ?? resolution.sourceValue;

      if (!key || seenKindKeys.has(key)) {
        continue;
      }

      mergedKinds.push({
        key,
        displayLabel,
      });
      seenKindKeys.add(key);
    }

    return mergedKinds;
  }, [currentUnitTypes, newKindResolutions]);
  const newKindKeys = useMemo(
    () =>
      new Set(
        newKindResolutions.map(
          (resolution) =>
            resolution.resolvedOrgUnitKindKey ??
            resolution.suggestedOrgUnitKindKey
        )
      ),
    [newKindResolutions]
  );
  const isTerminalSession =
    activeSession?.stage === "Applied" || activeSession?.stage === "Expired";
  const canValidateCurrentReview =
    !!activeSession &&
    !isTerminalSession &&
    !isAutoReviewInProgress &&
    activeSession.stage !== "Validated" &&
    activeSession.canValidate;
  const canCheckCurrentReview =
    !!activeSession &&
    !isTerminalSession &&
    !isAutoReviewInProgress &&
    activeSession.stage === "Validated" &&
    activeSession.validationSummary.errorCount > 0;
  const canChooseAnotherFile =
    !readOnly && !isAutoReviewInProgress && !applyImport.isLoading;
  const canReplaceDraft =
    !readOnly &&
    !isAutoReviewInProgress &&
    !applyImport.isLoading &&
    !!activeSession?.canApply;

  useEffect(() => {
    if (!(sessionError instanceof ApiError) || !sessionId) {
      return;
    }

    if (sessionError.status !== 400 && sessionError.status !== 404) {
      return;
    }

    setPageError(sessionError.errors.join(", "));
    onSessionIdChange(null);
  }, [onSessionIdChange, sessionError, sessionId]);

  useEffect(() => {
    if (open) {
      return;
    }

    setPendingFileName(null);
    setPageError(null);
  }, [open]);

  useEffect(() => {
    setSelectedPreviewNodeId(null);
  }, [sessionId]);

  useEffect(() => {
    if (!selectedPreviewNodeId) {
      const firstNodeId = getFirstDraftTreeNodeId(previewTree);
      if (firstNodeId) {
        setSelectedPreviewNodeId(firstNodeId);
      }
      return;
    }

    if (findDraftTreeNodeById(previewTree, selectedPreviewNodeId)) {
      return;
    }

    setSelectedPreviewNodeId(getFirstDraftTreeNodeId(previewTree));
  }, [previewTree, selectedPreviewNodeId]);

  const handleApiError = (error: unknown, fallbackMessage: string) => {
    if (error instanceof ApiError) {
      setPageError(error.errors.join(", "));
      return;
    }

    setPageError(fallbackMessage);
  };

  const handleDownloadTemplate = async () => {
    setPageError(null);

    try {
      const blob = await downloadTemplate.mutateAsync(undefined);
      downloadBlob(blob, "draft-structure-template.csv");
    } catch (error) {
      handleApiError(error, "The template download failed.");
    }
  };

  const handleFileSelection = async (file: File | null) => {
    if (readOnly) {
      setPageError(readOnlyMessage);
      return;
    }

    if (!file) {
      return;
    }

    setPageError(null);
    setPendingFileName(file.name);
    setSelectedPreviewNodeId(null);

    let nextSessionId: string | null = null;

    try {
      const nextSession = await uploadImport.mutateAsync(file);
      nextSessionId = nextSession.id;
      onSessionIdChange(nextSession.id);
      await validateImport.mutateAsync({ sessionId: nextSession.id });
    } catch (error) {
      handleApiError(
        error,
        nextSessionId ? "Validation failed." : "The CSV upload failed."
      );
    } finally {
      setPendingFileName(null);
    }
  };

  const handleStartNewImport = () => {
    if (readOnly) {
      setPageError(readOnlyMessage);
      return;
    }

    setPendingFileName(null);
    setPageError(null);
    setSelectedPreviewNodeId(null);
    onSessionIdChange(null);
  };

  const handleValidate = async () => {
    if (readOnly) {
      setPageError(readOnlyMessage);
      return;
    }

    if (!sessionId) {
      return;
    }

    setPageError(null);

    try {
      await validateImport.mutateAsync({ sessionId });
      setSelectedPreviewNodeId(null);
    } catch (error) {
      handleApiError(error, "Validation failed.");
    }
  };

  const handleApply = async () => {
    if (readOnly) {
      setPageError(readOnlyMessage);
      return;
    }

    if (!sessionId) {
      return;
    }

    setPageError(null);

    try {
      const result = await applyImport.mutateAsync({ sessionId });
      toast.success(
        `Replaced the draft with ${result.replacedUnitCount} units`
      );
      await onApplied?.(result);
      onSessionIdChange(null);
      onOpenChange(false);
    } catch (error) {
      handleApiError(error, "Replacing the draft workspace failed.");
    }
  };

  const hasSession = !!activeSession;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,56rem)] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="border-b p-5 pr-14">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <DialogTitle>Import structure from template</DialogTitle>
              <DialogDescription>
                {readOnly
                  ? readOnlyMessage
                  : "Download the template, upload it, then review it before replacing the draft."}
              </DialogDescription>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleDownloadTemplate}>
                {downloadTemplate.isLoading ? (
                  <Spinner className="mr-1" />
                ) : (
                  <FileSpreadsheet className="size-4" />
                )}
                Download Template
              </Button>
              {canChooseAnotherFile ? (
                <Button variant="outline" onClick={handleStartNewImport}>
                  Choose another file
                </Button>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 flex-col overflow-y-auto p-5">
          {isInitialPanelLoading ? (
            <ImportPanelSkeleton />
          ) : (
            <div className="flex flex-1 flex-col gap-4">
              {readOnly ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{readOnlyTitle}</AlertTitle>
                  <AlertDescription>{readOnlyMessage}</AlertDescription>
                </Alert>
              ) : null}
              {pageError || (sessionId ? sessionError : null) ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Import is blocked</AlertTitle>
                  <AlertDescription>
                    {pageError ?? (sessionId ? sessionError?.message : null)}
                  </AlertDescription>
                </Alert>
              ) : null}

              {isProcessingSelectedFile ? (
                <div className="flex items-center gap-3 rounded-xl border bg-muted/20 p-4">
                  <div className="flex size-8 items-center justify-center rounded-full bg-background text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Validating import</p>
                    <p className="text-sm text-muted-foreground">
                      Reviewing {pendingFileName ?? "the selected file"}...
                    </p>
                  </div>
                </div>
              ) : null}

              {hasSession ? (
                <div className="space-y-4">
                  <div
                    className={cn(
                      "space-y-4 rounded-xl border p-4",
                      importProgress?.tone ? stageTones[importProgress.tone] : ""
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">
                          {importProgress?.label ?? "Waiting for file"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {importProgress?.hint ??
                            `Expires ${formatTimestamp(activeSession.expiresAt)}`}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {activeSession.sourceFileName}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-4 gap-px overflow-hidden rounded-lg border bg-muted/30">
                      <StatCell
                        label="Rows"
                        value={String(activeSession.sourceRowCount)}
                      />
                      <StatCell
                        label="Issues"
                        value={String(activeSession.validationSummary.errorCount)}
                        muted={activeSession.stage !== "Validated"}
                      />
                      <StatCell
                        label="Ready"
                        value={String(activeSession.validationSummary.validRows)}
                        muted={activeSession.stage !== "Validated"}
                      />
                      <StatCell
                        label="New types"
                        value={String(newKindResolutions.length)}
                      />
                    </div>

                    {sessionUnitTypes.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {sessionUnitTypes.map((kind) => (
                          <Badge
                            key={kind.key}
                            variant={
                              newKindKeys.has(kind.key) ? "outline" : "secondary"
                            }
                            className="text-xs"
                          >
                            {kind.displayLabel}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                    <div className="min-h-0 space-y-2">
                      <p className="text-sm font-medium">Validation issues</p>
                      {activeSession.validationIssues.length === 0 ? (
                        <div className="flex items-center justify-center rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                          {activeSession.stage === "Validated"
                            ? "No issues found."
                            : "Validate the file to see issues here."}
                        </div>
                      ) : (
                        <div className="max-h-80 overflow-auto rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-12">Row</TableHead>
                                <TableHead className="w-28">Field</TableHead>
                                <TableHead>Issue</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {activeSession.validationIssues.map((issue) => (
                                <TableRow
                                  key={`${issue.rowNumber}-${issue.code}-${issue.field ?? "general"}`}
                                >
                                  <TableCell className="text-xs tabular-nums">
                                    {issue.rowNumber}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {getImportFieldLabel(
                                      issue.field,
                                      activeSession.importSchema
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-start gap-2">
                                      <Badge
                                        variant={
                                          issue.severity === "error"
                                            ? "destructive"
                                            : "secondary"
                                        }
                                        className="shrink-0 text-[10px]"
                                      >
                                        {issue.severity}
                                      </Badge>
                                      <span className="text-sm text-muted-foreground">
                                        {issue.message}
                                      </span>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>

                    <div className="min-h-0 space-y-2">
                      <p className="text-sm font-medium">Staged tree preview</p>
                      <DraftStructureTree
                        nodes={previewTree}
                        selectedId={selectedPreviewNodeId}
                        onSelect={(node) => setSelectedPreviewNodeId(node.id)}
                        emptyTitle="No staged tree yet"
                        emptyDescription="Validate the uploaded file to build the staged tree preview."
                        readOnly
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <DropZone
                  onFileSelected={(file) => void handleFileSelection(file)}
                  disabled={
                    readOnly || isAutoReviewInProgress || applyImport.isLoading
                  }
                />
              )}

              {isSessionLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner />
                  Loading import session...
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="border-t bg-muted/30 px-5 py-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-muted-foreground">
              {isProcessingSelectedFile
                ? `Validating ${pendingFileName ?? "the selected file"}...`
                : pageError
                  ? "Resolve the import issue before replacing the draft."
                  : activeSession && !canReplaceDraft
                    ? "Replace draft becomes available after a clean validation."
                    : activeSession && canReplaceDraft
                      ? "Review looks clean. Replace the draft when ready."
                      : "Choose a file to start."}
            </p>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {(canValidateCurrentReview || canCheckCurrentReview) &&
              pageError ? (
                <Button
                  onClick={handleValidate}
                  disabled={readOnly || validateImport.isLoading}
                >
                  {validateImport.isLoading ? (
                    <Spinner className="mr-1" />
                  ) : null}
                  Retry validation
                </Button>
              ) : null}
              <Button
                onClick={handleApply}
                disabled={
                  isAutoReviewInProgress ||
                  applyImport.isLoading ||
                  !canReplaceDraft
                }
              >
                {applyImport.isLoading ? <Spinner className="mr-1" /> : null}
                {applyImport.isLoading ? "Replacing draft..." : "Replace draft"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatCell({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className={cn("bg-background px-3 py-2.5", muted ? "opacity-50" : "")}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-semibold leading-tight">{value}</p>
    </div>
  );
}

function ImportPanelSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-4">
        <div className="grid grid-cols-4 gap-px overflow-hidden rounded-lg border bg-muted/30">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="bg-background px-3 py-2.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-1 h-5 w-12" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-2">
          <Skeleton className="h-5 w-28" />
          <div className="rounded-lg border p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="mb-2 h-8 w-full last:mb-0" />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <div className="rounded-lg border p-4">
            <Skeleton className="mb-2 h-8 w-36" />
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="mb-2 h-7 w-full last:mb-0" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
