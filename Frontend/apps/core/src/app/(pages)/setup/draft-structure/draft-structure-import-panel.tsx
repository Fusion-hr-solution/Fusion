"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  LoaderCircle,
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
import { Input } from "@/components/ui/input";
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
      title: "Review expired",
      description: "Upload again.",
    };
  }

  if (stage === "Applied") {
    return {
      title: "Draft updated",
      description: "This file already replaced the draft.",
    };
  }

  if (canApply) {
    return {
      title: "Ready to replace draft",
      description: "The review is clean.",
    };
  }

  if (stage === "Validated" && errorCount > 0) {
    return {
      title: "Fix the file",
      description: "Fix it, then upload again.",
    };
  }

  if (canValidate) {
    return {
      title: "Ready to validate",
      description: "Validate to build the preview.",
    };
  }

  if (stage === "KindReconciled" || stage === "Mapped") {
    return {
      title: "File uploaded",
      description: "Validate to continue.",
    };
  }

  return {
    title: "File uploaded",
    description: "Validate to continue.",
  };
}

export function DraftStructureImportPanel({
  open,
  onOpenChange,
  onApplied,
  readOnly = false,
  readOnlyTitle = "Import is unavailable",
  readOnlyMessage = "This draft is read-only.",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied?: (
    result: DraftStructureImportApplyResultDto
  ) => void | Promise<void>;
  readOnly?: boolean;
  readOnlyTitle?: string;
  readOnlyMessage?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [selectedPreviewNodeId, setSelectedPreviewNodeId] = useState<
    string | null
  >(null);

  const {
    data: session,
    error: sessionError,
    isLoading: isSessionLoading,
  } = useDraftStructureImportSession(sessionId, !!sessionId);
  const { data: importSchema } = useDraftStructureImportSchema(open);
  const uploadImport = useUploadDraftStructureImport();
  const downloadTemplate = useDownloadDraftStructureTemplate();
  const validateImport = useValidateDraftStructureImport();
  const applyImport = useApplyDraftStructureImport();
  const activeSession = sessionId ? (session ?? null) : null;
  const isAutoReviewInProgress =
    uploadImport.isLoading || validateImport.isLoading;
  const isProcessingSelectedFile = !!pendingFileName && isAutoReviewInProgress;
  const isInitialPanelLoading =
    open &&
    !pageError &&
    !sessionError &&
    (!importSchema || (!!sessionId && isSessionLoading && !activeSession));

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

  const syncImportRoute = useCallback(
    ({
      nextSessionId,
      nextOpen = true,
    }: {
      nextSessionId?: string | null;
      nextOpen?: boolean;
    }) => {
      const params = new URLSearchParams(searchParams.toString());

      if (nextOpen) {
        params.set("import", "1");
      } else {
        params.delete("import");
      }

      if (nextSessionId) {
        params.set("session", nextSessionId);
      } else {
        params.delete("session");
      }

      const query = params.toString();

      router.replace(
        query ? `/setup/draft-structure?${query}` : "/setup/draft-structure"
      );
    },
    [router, searchParams]
  );

  useEffect(() => {
    if (!(sessionError instanceof ApiError) || !sessionId) {
      return;
    }

    if (sessionError.status !== 400 && sessionError.status !== 404) {
      return;
    }

    setPageError(sessionError.errors.join(", "));
    syncImportRoute({ nextSessionId: null });
  }, [sessionError, sessionId, syncImportRoute]);

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

  const openFilePicker = () => {
    if (readOnly || isAutoReviewInProgress || applyImport.isLoading) {
      return;
    }

    fileInputRef.current?.click();
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
      syncImportRoute({ nextSessionId });
      await validateImport.mutateAsync({ sessionId: nextSession.id });
    } catch (error) {
      handleApiError(
        error,
        nextSessionId ? "Validation failed." : "The CSV upload failed."
      );
    } finally {
      setPendingFileName(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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
    syncImportRoute({ nextSessionId: null });
    openFilePicker();
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
      syncImportRoute({ nextSessionId: null, nextOpen: false });
    } catch (error) {
      handleApiError(error, "Replacing the draft workspace failed.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(92vh,56rem)] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="border-b p-6 pr-14">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
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

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {isInitialPanelLoading ? (
            <ImportPanelSkeleton />
          ) : (
            <>
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
                <div className="rounded-2xl border bg-muted/20 p-5">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-9 items-center justify-center rounded-full bg-background text-muted-foreground">
                      <LoaderCircle className="size-4 animate-spin" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Validating import</p>
                      <p className="text-sm text-muted-foreground">
                        Reviewing {pendingFileName ?? "the selected file"} and
                        building the staged tree preview.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeSession ? (
                <div className="rounded-2xl border p-5">
                  <div className="space-y-5">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {importProgress?.title ?? "Waiting for file"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {importProgress?.description ??
                          `Expires ${formatTimestamp(activeSession.expiresAt)}`}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <ImportOverviewStat
                        label="Rows"
                        value={String(activeSession.sourceRowCount)}
                        hint={activeSession.sourceFileName}
                      />
                      <ImportOverviewStat
                        label="Issues"
                        value={String(
                          activeSession.validationSummary.errorCount
                        )}
                        hint={
                          activeSession.stage === "Validated"
                            ? `${activeSession.validationSummary.validRows} rows ready`
                            : "Validate to review the file"
                        }
                      />
                      <ImportOverviewStat
                        label="Ready rows"
                        value={String(
                          activeSession.validationSummary.validRows
                        )}
                        hint={
                          activeSession.stage === "Validated"
                            ? "Rows ready to stage"
                            : "Shown after validation"
                        }
                      />
                      <ImportOverviewStat
                        label="New types"
                        value={String(newKindResolutions.length)}
                        hint={
                          newKindResolutions.length > 0
                            ? "Added when the draft is replaced"
                            : "No new types"
                        }
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">Unit types</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Outlined types are new in this file.
                          </p>
                        </div>
                        {newKindResolutions.length > 0 ? (
                          <Badge variant="outline">
                            {newKindResolutions.length} new
                          </Badge>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {sessionUnitTypes.length > 0 ? (
                          sessionUnitTypes.map((kind) => (
                            <Badge
                              key={kind.key}
                              variant={
                                newKindKeys.has(kind.key)
                                  ? "outline"
                                  : "secondary"
                              }
                            >
                              {kind.displayLabel}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Unit types load with the current draft schema.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed p-6">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        Choose template file
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Select the CSV template and the review will run
                        automatically.
                      </p>
                    </div>

                    <Input
                      ref={fileInputRef}
                      id="draft-structure-import-file"
                      type="file"
                      accept=".csv,text/csv"
                      disabled={
                        readOnly ||
                        isAutoReviewInProgress ||
                        applyImport.isLoading
                      }
                      onChange={(event) => {
                        void handleFileSelection(
                          event.target.files?.[0] ?? null
                        );
                      }}
                    />

                    <div className="flex flex-wrap gap-2">
                      {sessionUnitTypes.length > 0 ? (
                        sessionUnitTypes.map((kind) => (
                          <Badge key={kind.key} variant="secondary">
                            {kind.displayLabel}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Unit types load with the current draft schema.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeSession ? (
                <>
                  <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium">Validation issues</p>
                        <p className="text-sm text-muted-foreground">
                          Fix these in the file, then upload again.
                        </p>
                      </div>

                      {activeSession.validationIssues.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                          {activeSession.stage === "Validated"
                            ? "No issues found."
                            : "Validate the file to see issues here."}
                        </div>
                      ) : (
                        <div className="max-h-96 overflow-auto rounded-xl border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Row</TableHead>
                                <TableHead>Field</TableHead>
                                <TableHead>Issue</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {activeSession.validationIssues.map((issue) => (
                                <TableRow
                                  key={`${issue.rowNumber}-${issue.code}-${issue.field ?? "general"}`}
                                >
                                  <TableCell>{issue.rowNumber}</TableCell>
                                  <TableCell>
                                    {getImportFieldLabel(
                                      issue.field,
                                      activeSession.importSchema
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col gap-1">
                                      <Badge
                                        variant={
                                          issue.severity === "error"
                                            ? "destructive"
                                            : "secondary"
                                        }
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

                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium">
                          Staged tree preview
                        </p>
                      </div>

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
                </>
              ) : (
                <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                  Choose a file to start the review.
                </div>
              )}

              {isSessionLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner />
                  Loading import session...
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="border-t bg-muted/30 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {isProcessingSelectedFile ? (
                <p className="text-sm text-muted-foreground">
                  Validating {pendingFileName ?? "the selected file"}...
                </p>
              ) : pageError ? (
                <p className="text-sm text-muted-foreground">
                  Resolve the import issue before replacing the draft.
                </p>
              ) : activeSession && !canReplaceDraft ? (
                <p className="text-sm text-muted-foreground">
                  Replace draft becomes available after a clean validation.
                </p>
              ) : activeSession && canReplaceDraft ? (
                <p className="text-sm text-muted-foreground">
                  Review looks clean. Replace the draft when ready.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Choose a file to start.
                </p>
              )}
            </div>

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

function ImportOverviewStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold leading-tight">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

function ImportPanelSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-2xl border p-5">
          <div className="grid gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
        <div className="rounded-2xl border p-5">
          <div className="space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-48" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-xl border p-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-7 w-32" />
            <Skeleton className="mt-3 h-4 w-full" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-40" />
          <div className="rounded-xl border p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-44" />
          <div className="rounded-xl border p-4 space-y-3">
            <Skeleton className="h-8 w-48" />
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
