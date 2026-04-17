"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCcw,
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
      title: "Session expired",
      description: "Upload the file again to continue the review.",
    };
  }

  if (stage === "Applied") {
    return {
      title: "Draft replaced",
      description: "This import has already replaced the current working draft.",
    };
  }

  if (canApply) {
    return {
      title: "Ready to replace draft",
      description: "Validation is complete and the staged hierarchy is ready to replace the current working draft.",
    };
  }

  if (stage === "Validated" && errorCount > 0) {
    return {
      title: "Fix validation issues",
      description: "Review the flagged rows below, then validate again when the file is corrected.",
    };
  }

  if (canValidate) {
    return {
      title: "Ready to validate",
      description: "The file matches the official template and is ready for a full review.",
    };
  }

  if (stage === "KindReconciled" || stage === "Mapped") {
    return {
      title: "Uploaded and prepared",
      description: "The file has been prepared for review and validation.",
    };
  }

  return {
    title: "File uploaded",
    description: "Continue by validating the file and reviewing the staged hierarchy.",
  };
}

export function DraftStructureImportPanel({
  open,
  onOpenChange,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied: () => void;
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
  const uploadImport = useUploadDraftStructureImport();
  const downloadTemplate = useDownloadDraftStructureTemplate();
  const validateImport = useValidateDraftStructureImport();
  const applyImport = useApplyDraftStructureImport();

  const previewTree = useMemo(
    () =>
      buildImportPreviewDraftTree(
        session?.previewRows ?? [],
        session?.validationIssues ?? []
      ),
    [session?.previewRows, session?.validationIssues]
  );
  const selectedPreviewNode = findDraftTreeNodeById(
    previewTree,
    selectedPreviewNodeId
  );
  const importProgress = session
    ? getImportProgressSummary({
        stage: session.stage,
        canValidate: session.canValidate,
        canApply: session.canApply,
        errorCount: session.validationSummary.errorCount,
      })
    : null;

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

  const updateQuery = (nextSessionId?: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("import", "1");

    if (nextSessionId) {
      params.set("session", nextSessionId);
    } else {
      params.delete("session");
    }

    router.replace(`/setup/draft-structure?${params.toString()}`);
  };

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
    if (!selectedFile) {
      setPageError("Choose the official draft-structure template before uploading.");
      return;
    }

    setPageError(null);

    try {
      const nextSession = await uploadImport.mutateAsync(selectedFile);
      toast.success(`Uploaded ${nextSession.sourceRowCount} rows from template`);
      setSelectedFile(null);
      updateQuery(nextSession.id);
    } catch (error) {
      handleApiError(error, "The CSV upload failed.");
    }
  };

  const handleValidate = async () => {
    if (!sessionId) {
      return;
    }

    setPageError(null);

    try {
      await validateImport.mutateAsync({ sessionId });
      toast.success("Template validated");
      await refetchSession();
    } catch (error) {
      handleApiError(error, "Validation failed.");
    }
  };

  const handleApply = async () => {
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
                Download the official CSV, fill it offline, upload it here,
                review the staged structure, then replace the current draft only
                when it looks right.
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
              {sessionId ? (
                <Button variant="outline" onClick={() => refetchSession()}>
                  <RefreshCcw className="size-4" />
                  Refresh Session
                </Button>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {pageError || sessionError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Import is blocked</AlertTitle>
              <AlertDescription>{pageError ?? sessionError?.message}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-2xl border bg-muted/20 p-5">
              <p className="text-sm font-medium">How this works</p>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <p>1. Download the official template from this modal.</p>
                <p>2. Keep the column names unchanged and fill the rows offline.</p>
                <p>3. Upload the file, validate it, review the staged hierarchy, then replace the draft workspace.</p>
              </div>
            </div>

            <div className="rounded-2xl border p-5">
              <div className="grid gap-2">
                <Label htmlFor="draft-structure-import-file">Template file</Label>
                <Input
                  id="draft-structure-import-file"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    setSelectedFile(event.target.files?.[0] ?? null);
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleUpload} disabled={!selectedFile || uploadImport.isLoading}>
                    {uploadImport.isLoading ? (
                      <Spinner className="mr-1" />
                    ) : (
                      <Upload className="size-4" />
                    )}
                    Upload Template
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  This flow is template-only. If the official columns are renamed,
                  removed, or reordered, the upload is rejected before validation.
                </p>
              </div>
            </div>
          </div>

          {session ? (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader>
                    <CardDescription>Review status</CardDescription>
                    <CardTitle>{importProgress?.title ?? "Waiting for file"}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {importProgress?.description ?? `Expires ${formatTimestamp(session.expiresAt)}`}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardDescription>Rows in file</CardDescription>
                    <CardTitle>{session.sourceRowCount}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    File: {session.sourceFileName}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardDescription>Issues to fix</CardDescription>
                    <CardTitle>{session.validationSummary.errorCount}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {session.stage === "Validated"
                      ? `${session.validationSummary.validRows} rows are ready`
                      : "Validate the upload to generate the staged preview."}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardDescription>New unit types</CardDescription>
                    <CardTitle>
                      {session.kindResolutions.filter((resolution) => resolution.createNewKind).length}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    New valid types are created automatically during apply.
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">Validation issues</p>
                    <p className="text-sm text-muted-foreground">
                      Clear file issues here before replacing the current draft.
                    </p>
                  </div>

                  {session.validationIssues.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                      {session.stage === "Validated"
                        ? "No validation issues were found in this template."
                        : "Validate the uploaded template to see staged issues here."}
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
                          {session.validationIssues.map((issue) => (
                            <TableRow key={`${issue.rowNumber}-${issue.code}-${issue.field ?? "general"}`}>
                              <TableCell>{issue.rowNumber}</TableCell>
                              <TableCell>
                                {getImportFieldLabel(issue.field, session.importSchema)}
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
                      The preview uses the same tree surface as the manual workspace so you can review the resulting hierarchy before replacing the draft.
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
                          {selectedPreviewNode.issueSummary.errorCount > 0 ? (
                            <Badge variant="destructive">
                              {selectedPreviewNode.issueSummary.errorCount} error
                              {selectedPreviewNode.issueSummary.errorCount === 1 ? "" : "s"}
                            </Badge>
                          ) : null}
                        </div>
                        <CardTitle className="mt-2">{selectedPreviewNode.displayName}</CardTitle>
                        <CardDescription>
                          Review the staged hierarchy fields before replacing the current draft.
                        </CardDescription>
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
                            <p className="text-sm text-muted-foreground">
                              Secondary values stay here so the main hierarchy remains easy to review.
                            </p>
                          </div>
                          <div className="mt-4 grid gap-3">
                            <ImportField
                              label="Business Code"
                              value={selectedPreviewNode.businessCode ?? "Not set"}
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
              Upload the official template to start a staged import session in this workspace.
            </div>
          )}

          {isSessionLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner />
              Loading import session...
            </div>
          ) : null}
        </div>

        <div className="border-t bg-muted/30 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {session ? (
                <>
                  <Badge variant={session.canValidate ? "default" : "secondary"}>
                    {session.canValidate ? "Ready to validate" : "Upload accepted"}
                  </Badge>
                  {session.canApply ? (
                    <Badge variant="outline">
                      <CheckCircle2 className="mr-1 size-3" />
                      Ready to replace draft
                    </Badge>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Start by downloading the official template or uploading a completed file.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Back to Workspace
              </Button>
              <Button
                onClick={handleValidate}
                disabled={validateImport.isLoading || !session?.canValidate}
              >
                {validateImport.isLoading ? <Spinner className="mr-1" /> : null}
                Validate Template
              </Button>
              <Button
                onClick={handleApply}
                disabled={applyImport.isLoading || !session?.canApply}
              >
                {applyImport.isLoading ? <Spinner className="mr-1" /> : null}
                Replace Draft Workspace
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