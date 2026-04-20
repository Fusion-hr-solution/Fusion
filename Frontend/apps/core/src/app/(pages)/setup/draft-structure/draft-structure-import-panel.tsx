"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import { ApiError, type DraftStructureImportStage } from "@repo/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      description: "Upload the file again.",
    };
  }

  if (stage === "Applied") {
    return {
      title: "Draft updated",
      description: "This file has already replaced the draft.",
    };
  }

  if (canApply) {
    return {
      title: "Ready to replace draft",
      description: "The review is clean and ready.",
    };
  }

  if (stage === "Validated" && errorCount > 0) {
    return {
      title: "Fix the file",
      description: "Upload a corrected file to continue.",
    };
  }

  if (canValidate) {
    return {
      title: "Ready to review",
      description: "Validate the file to build the preview.",
    };
  }

  if (stage === "KindReconciled" || stage === "Mapped") {
    return {
      title: "File uploaded",
      description: "Validate the file to continue.",
    };
  }

  return {
    title: "File uploaded",
    description: "Validate the file to continue.",
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
  onApplied: () => void;
  readOnly?: boolean;
  readOnlyTitle?: string;
  readOnlyMessage?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [selectedPreviewNodeId, setSelectedPreviewNodeId] = useState<string | null>(null);

  const {
    data: session,
    error: sessionError,
    isLoading: isSessionLoading,
    refetch: refetchSession,
  } = useDraftStructureImportSession(sessionId, !!sessionId);
  const { data: importSchema } = useDraftStructureImportSchema(open);
  const uploadImport = useUploadDraftStructureImport();
  const downloadTemplate = useDownloadDraftStructureTemplate();
  const validateImport = useValidateDraftStructureImport();
  const applyImport = useApplyDraftStructureImport();
  const hasPendingUpload = !!selectedFile;
  const activeSession = sessionId ? session ?? null : null;
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
  const selectedPreviewNode = findDraftTreeNodeById(
    previewTree,
    selectedPreviewNodeId
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
    () => activeSession?.kindResolutions.filter((resolution) => resolution.createNewKind) ?? [],
    [activeSession?.kindResolutions]
  );
  const sessionUnitTypes = useMemo(() => {
    const mergedKinds = [...currentUnitTypes];
    const seenKindKeys = new Set(currentUnitTypes.map((kind) => kind.key));

    for (const resolution of newKindResolutions) {
      const key = resolution.resolvedOrgUnitKindKey ?? resolution.suggestedOrgUnitKindKey;
      const displayLabel = resolution.resolvedDisplayLabel ?? resolution.sourceValue;

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
            resolution.resolvedOrgUnitKindKey ?? resolution.suggestedOrgUnitKindKey
        )
      ),
    [newKindResolutions]
  );
  const isTerminalSession =
    activeSession?.stage === "Applied" || activeSession?.stage === "Expired";
  const canStartNewImport = !!sessionId;
  const canValidateCurrentReview =
    !!activeSession &&
    !isTerminalSession &&
    !hasPendingUpload &&
    activeSession.stage !== "Validated" &&
    activeSession.canValidate;
  const canCheckCurrentReview =
    !!activeSession &&
    !isTerminalSession &&
    !hasPendingUpload &&
    activeSession.stage === "Validated" &&
    activeSession.validationSummary.errorCount > 0;
  const validateActionLabel = canCheckCurrentReview ? "Check Again" : "Validate File";
  const pendingUploadMessage = sessionId
    ? "Upload the selected file to start a new review."
    : "Upload the selected file to start the review.";

  const updateQuery = useCallback(
    (nextSessionId?: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("import", "1");

      if (nextSessionId) {
        params.set("session", nextSessionId);
      } else {
        params.delete("session");
      }

      router.replace(`/setup/draft-structure?${params.toString()}`);
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
    updateQuery(null);
  }, [sessionError, sessionId, updateQuery]);

  useEffect(() => {
    if (open) {
      return;
    }

    setSelectedFile(null);
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

  const handleUpload = async () => {
    if (readOnly) {
      setPageError(readOnlyMessage);
      return;
    }

    if (!selectedFile) {
      setPageError("Choose the official draft-structure template before uploading.");
      return;
    }

    setPageError(null);

    try {
      const nextSession = await uploadImport.mutateAsync(selectedFile);
      toast.success(
        sessionId
          ? `Started a new review with ${nextSession.sourceRowCount} rows`
          : `Uploaded ${nextSession.sourceRowCount} rows`
      );
      setSelectedFile(null);
      setSelectedPreviewNodeId(null);
      updateQuery(nextSession.id);
    } catch (error) {
      handleApiError(error, "The CSV upload failed.");
    }
  };

  const handleStartNewImport = () => {
    if (readOnly) {
      setPageError(readOnlyMessage);
      return;
    }

    setSelectedFile(null);
    setPageError(null);
    setSelectedPreviewNodeId(null);
    updateQuery(null);
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
      toast.success(canCheckCurrentReview ? "Review updated" : "File validated");
      setSelectedPreviewNodeId(null);
      await refetchSession();
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
      toast.success(`Replaced draft workspace with ${result.replacedUnitCount} units`);
      onApplied();
      updateQuery(null);
      onOpenChange(false);
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
                  : "Download the template, fill it offline, upload it, then review the draft before you replace it."}
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
              {canStartNewImport ? (
                <Button variant="outline" onClick={handleStartNewImport} disabled={readOnly}>
                  New Import
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

          {activeSession ? (
            <div className="rounded-2xl border p-5">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">Unit types</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Outlined types are new in this file.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sessionUnitTypes.length > 0 ? (
                    sessionUnitTypes.map((kind) => (
                      <Badge
                        key={kind.key}
                        variant={newKindKeys.has(kind.key) ? "outline" : "secondary"}
                      >
                        {kind.displayLabel}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Unit types will appear here after the schema loads.
                    </span>
                  )}
                </div>
                {newKindResolutions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    This file does not add any new types.
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-2xl border p-5">
                <div className="grid gap-2">
                  <Label htmlFor="draft-structure-import-file">Template file</Label>
                  <Input
                    id="draft-structure-import-file"
                    type="file"
                    accept=".csv,text/csv"
                    disabled={readOnly}
                    onChange={(event) => {
                      setSelectedFile(event.target.files?.[0] ?? null);
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={handleUpload}
                      disabled={readOnly || !selectedFile || uploadImport.isLoading}
                    >
                      {uploadImport.isLoading ? (
                        <Spinner className="mr-1" />
                      ) : (
                        <Upload className="size-4" />
                      )}
                      Upload File
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use the downloaded template as-is.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border p-5">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">Unit types</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Current types in the draft.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sessionUnitTypes.length > 0 ? (
                      sessionUnitTypes.map((kind) => (
                        <Badge key={kind.key} variant="secondary">
                          {kind.displayLabel}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Unit types will appear here after the schema loads.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSession ? (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader>
                    <CardDescription>Review status</CardDescription>
                    <CardTitle>{importProgress?.title ?? "Waiting for file"}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {importProgress?.description ?? `Expires ${formatTimestamp(activeSession.expiresAt)}`}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardDescription>Rows in file</CardDescription>
                    <CardTitle>{activeSession.sourceRowCount}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    File: {activeSession.sourceFileName}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardDescription>Issues to fix</CardDescription>
                    <CardTitle>{activeSession.validationSummary.errorCount}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {activeSession.stage === "Validated"
                      ? `${activeSession.validationSummary.validRows} rows are ready`
                      : "Validate the file to review it."}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardDescription>New unit types</CardDescription>
                    <CardTitle>
                      {activeSession.kindResolutions.filter((resolution) => resolution.createNewKind).length}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    Created automatically when you replace the draft.
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">Validation issues</p>
                    <p className="text-sm text-muted-foreground">
                      Fix these in the file, then upload it again.
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
                            <TableRow key={`${issue.rowNumber}-${issue.code}-${issue.field ?? "general"}`}>
                              <TableCell>{issue.rowNumber}</TableCell>
                              <TableCell>
                                {getImportFieldLabel(issue.field, activeSession.importSchema)}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <Badge variant={issue.severity === "error" ? "destructive" : "secondary"}>
                                    {issue.severity}
                                  </Badge>
                                  <span className="text-sm text-muted-foreground">{issue.message}</span>
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
                    <p className="text-sm font-medium">Staged tree preview</p>
                    <p className="text-sm text-muted-foreground">
                      Review the draft before you replace it.
                    </p>
                  </div>

                  <DraftStructureTree
                    nodes={previewTree}
                    selectedId={selectedPreviewNodeId}
                    onSelect={(node) => setSelectedPreviewNodeId(node.id)}
                    emptyTitle="No staged tree yet"
                    emptyDescription="Validate the uploaded template to generate the staged hierarchy preview."
                    readOnly
                  />

                  {selectedPreviewNode ? (
                    <Card>
                      <CardHeader>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{selectedPreviewNode.orgUnitKindLabel}</Badge>
                          {newKindKeys.has(selectedPreviewNode.orgUnitKindKey) ? (
                            <Badge variant="outline">New type from file</Badge>
                          ) : null}
                          {selectedPreviewNode.issueSummary.errorCount > 0 ? (
                            <Badge variant="destructive">
                              {selectedPreviewNode.issueSummary.errorCount} error
                              {selectedPreviewNode.issueSummary.errorCount === 1 ? "" : "s"}
                            </Badge>
                          ) : null}
                        </div>
                        <CardTitle className="mt-2">{selectedPreviewNode.displayName}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <ImportField label="Unit Name" value={selectedPreviewNode.displayName} />
                          <ImportField label="Unit Type" value={selectedPreviewNode.orgUnitKindLabel} />
                          <ImportField label="Unit Code" value={selectedPreviewNode.referenceKey} mono />
                          <ImportField
                            label="Parent Unit Code"
                            value={selectedPreviewNode.parentReferenceKey ?? "Organization root"}
                          />
                        </div>

                        <div className="rounded-xl border bg-muted/20 p-4">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">Optional details</p>
                          </div>
                          <div className="mt-4 grid gap-3">
                            <ImportField
                              label="Location"
                              value={selectedPreviewNode.location ?? "Not set"}
                            />
                            <ImportField
                              label="Description"
                              value={selectedPreviewNode.description ?? "Not set"}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              Upload a template to start the review.
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
              {hasPendingUpload ? (
                <p className="text-sm text-muted-foreground">{pendingUploadMessage}</p>
              ) : activeSession ? (
                <>
                  <Badge variant={activeSession.canValidate ? "default" : "secondary"}>
                    {activeSession.stage === "Validated"
                      ? activeSession.validationSummary.errorCount > 0
                        ? "Needs a new file"
                        : "Ready to replace draft"
                      : activeSession.canValidate
                        ? "Ready to validate"
                        : "Upload accepted"}
                  </Badge>
                  {activeSession.canApply ? (
                    <Badge variant="outline">
                      <CheckCircle2 className="mr-1 size-3" />
                      Ready
                    </Badge>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Upload a file to start.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {canValidateCurrentReview || canCheckCurrentReview ? (
                <Button
                  onClick={handleValidate}
                  disabled={readOnly || validateImport.isLoading}
                >
                  {validateImport.isLoading ? <Spinner className="mr-1" /> : null}
                  {validateActionLabel}
                </Button>
              ) : null}
              <Button
                onClick={handleApply}
                disabled={readOnly || applyImport.isLoading || !session?.canApply || hasPendingUpload}
              >
                {applyImport.isLoading ? <Spinner className="mr-1" /> : null}
                Replace Draft
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImportField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className={mono ? "mt-1 font-mono text-sm" : "mt-1 text-sm"}>{value}</p>
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
