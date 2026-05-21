"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  Eye,
  FileSpreadsheet,
  History,
  RefreshCcw,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import { PAGE_SIZE_OPTIONS, type PageSize } from "@repo/ui";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type {
  EmployeeImportApplyResultDto,
  EmployeeImportHistoryDetailDto,
  EmployeeImportHistoryPageDto,
  EmployeeImportSessionDto,
} from "./employee-import.types";
import type {
  EmployeeImportIssueGroup,
  EmployeeImportValidationUiModel,
} from "./employee-import-validation";
import {
  formatBytes,
  formatTimestamp,
  getErrorMessage,
} from "./employee-import-utils";
import { buildEmployeeFixHref } from "../employee-readiness";

const MAX_VISIBLE_SELECTED_ROWS = 12;

type SessionPresentation = {
  statusLabel: string;
  statusVariant: "default" | "secondary" | "outline" | "destructive";
  title: string;
  description: string;
  cardClassName: string;
};

type BatchMetaItem = {
  label: string;
  value: string | number;
};

type BatchIssueSummary = {
  groupCount: number;
  rawIssueCount: number;
  affectedRowCount: number;
};

function getSessionPresentation(
  session: EmployeeImportSessionDto,
  issueSummary?: BatchIssueSummary | null
): SessionPresentation {
  if (session.stage === "Expired") {
    return {
      statusLabel: "Upload expired",
      statusVariant: "destructive",
      title: "Upload expired",
      description:
        "Upload the CSV again to create a fresh batch before you continue.",
      cardClassName: "border-destructive/30 bg-destructive/5",
    };
  }

  if (
    session.stage === "Validated" &&
    session.validationSummary.errorCount > 0
  ) {
    const problemGroupCount =
      issueSummary?.groupCount ?? session.validationSummary.errorCount;
    const affectedRowCount =
      issueSummary?.affectedRowCount ?? session.validationSummary.errorCount;

    return {
      statusLabel: "Validation failed",
      statusVariant: "destructive",
      title: "Validation failed",
      description: `${problemGroupCount} problem group${problemGroupCount === 1 ? "" : "s"} across ${affectedRowCount} affected row${affectedRowCount === 1 ? "" : "s"}. Fix the CSV, upload the corrected file, and validate again.`,
      cardClassName: "border-destructive/30 bg-destructive/5",
    };
  }

  if (session.stage === "Validated") {
    return {
      statusLabel: "Validation passed",
      statusVariant: "secondary",
      title: "Validation passed",
      description:
        "All rows passed. Upload a replacement if the source data changes.",
      cardClassName: "border-emerald-200 bg-emerald-50/70",
    };
  }

  return {
    statusLabel: "Ready to validate",
    statusVariant: "outline",
    title: "Batch ready to validate",
    description:
      "Check the normalized preview below, then validate organization, duplicate, and manager references.",
    cardClassName: "border-border bg-card",
  };
}

function getBatchMetaItems(
  session: EmployeeImportSessionDto,
  issueSummary?: BatchIssueSummary | null
): BatchMetaItem[] {
  const isValidated = session.stage === "Validated";
  const hasErrors = session.validationSummary.errorCount > 0;

  if (isValidated && hasErrors && issueSummary) {
    return [
      {
        label: "File",
        value: session.sourceFileName,
      },
      {
        label: "Problem groups",
        value: issueSummary.groupCount,
      },
      {
        label: "Affected rows",
        value: issueSummary.affectedRowCount,
      },
      {
        label: "Row issues",
        value: issueSummary.rawIssueCount,
      },
    ];
  }

  if (isValidated) {
    return [
      {
        label: "File",
        value: session.sourceFileName,
      },
      {
        label: "Valid rows",
        value: session.validationSummary.validRows,
      },
      {
        label: "Total rows",
        value: session.sourceRowCount,
      },
    ];
  }

  return [
    {
      label: "File",
      value: session.sourceFileName,
    },
    {
      label: "Rows",
      value: session.sourceRowCount,
    },
    {
      label: "Size",
      value: formatBytes(session.sourceFileSizeBytes),
    },
    {
      label: "Expires",
      value: formatTimestamp(session.expiresAt),
    },
  ];
}

function BatchMetaPill({ label, value }: BatchMetaItem) {
  return (
    <div className="rounded-full border bg-background/80 px-3 py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>{" "}
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

export function BatchStatusPanel({
  session,
  isValidating,
  isUploading,
  isDownloadingTemplate,
  issueSummary,
  onValidate,
  onUpload,
  onDownloadTemplate,
}: {
  session: EmployeeImportSessionDto;
  isValidating: boolean;
  isUploading: boolean;
  isDownloadingTemplate: boolean;
  issueSummary?: BatchIssueSummary | null;
  onValidate: () => void;
  onUpload: () => void;
  onDownloadTemplate: () => void;
}) {
  const presentation = getSessionPresentation(session, issueSummary);
  const isValidated = session.stage === "Validated";
  const hasErrors = session.validationSummary.errorCount > 0;
  const isExpired = session.stage === "Expired";
  const uploadButtonLabel = isExpired
    ? "Upload file again"
    : isValidated && hasErrors
      ? "Upload corrected CSV"
      : isValidated
        ? "Upload replacement CSV"
        : "Upload different CSV";
  const metaItems = getBatchMetaItems(session, issueSummary);
  const statusIcon =
    isValidated && !hasErrors ? (
      <CheckCircle2 className="size-4 text-emerald-600" />
    ) : !isValidated && !isExpired ? (
      <Eye className="size-4 text-muted-foreground" />
    ) : (
      <AlertCircle className="size-4 text-destructive" />
    );

  return (
    <Card className={presentation.cardClassName}>
      <CardContent>
        <div className="flex flex-col gap-4 xl:flex-row xl:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {statusIcon}
              <span className="font-medium">{presentation.title}</span>
              <Badge variant={presentation.statusVariant}>
                {presentation.statusLabel}
              </Badge>
            </div>
            <p className="max-w-3xl text-sm text-muted-foreground">
              {presentation.description}
            </p>
            <div className="flex flex-wrap gap-2">
              {metaItems.map((item) => (
                <BatchMetaPill key={item.label} {...item} />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!isValidated && !isExpired ? (
              <Button
                type="button"
                onClick={onValidate}
                disabled={!session.canValidate || isValidating}
              >
                {isValidating ? <Spinner /> : <Eye />}
                Validate current file
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={onUpload}
              disabled={isUploading}
              variant={isExpired || hasErrors ? "default" : "outline"}
            >
              {isUploading ? <Spinner /> : <Upload />}
              {uploadButtonLabel}
            </Button>
            {isValidated && !isExpired ? (
              <Button
                type="button"
                onClick={onValidate}
                disabled={!session.canValidate || isValidating}
                variant="outline"
              >
                {isValidating ? <Spinner /> : <RefreshCcw />}
                Revalidate current file
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={onDownloadTemplate}
              disabled={isDownloadingTemplate}
            >
              {isDownloadingTemplate ? <Spinner /> : <Download />}
              Download template
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ApplyReadinessPanel({
  session,
  isApplying,
  applyError,
  onApply,
}: {
  session: EmployeeImportSessionDto;
  isApplying: boolean;
  applyError: string | null;
  onApply: () => Promise<void>;
}) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  if (!session.canApply) {
    return null;
  }

  const handleConfirm = async () => {
    await onApply();
    setIsConfirmOpen(false);
  };

  return (
    <Card className="border-amber-200 bg-amber-50/70">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-amber-200 bg-background/90 p-2">
            <ClipboardCheck className="size-5 text-amber-700" />
          </div>
          <div className="space-y-1">
            <CardTitle>Ready to apply this batch</CardTitle>
            <CardDescription>
              Creates new employees only. Existing records are not updated.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {applyError ? (
          <Alert variant="destructive">
            <AlertTitle>Apply failed</AlertTitle>
            <AlertDescription>
              <div className="space-y-1">
                <p>{applyError}</p>
                <p>Revalidate or upload a corrected CSV before retrying.</p>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <BatchMetaPill label="File" value={session.sourceFileName} />
          <BatchMetaPill label="Source rows" value={session.sourceRowCount} />
          <BatchMetaPill
            label="Rows to create"
            value={session.validationSummary.validRows}
          />
          <BatchMetaPill
            label="File size"
            value={formatBytes(session.sourceFileSizeBytes)}
          />
        </div>

        <div className="rounded-lg border border-amber-200/80 bg-background/85 p-3 text-sm text-muted-foreground">
          All rows are created together or none at all.
        </div>

        <div className="flex justify-end">
          <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button type="button" disabled={!session.canApply || isApplying}>
                {isApplying ? <Spinner /> : <ClipboardCheck />}
                Apply import
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogMedia>
                  <ShieldCheck className="size-5 text-amber-700" />
                </AlertDialogMedia>
                <AlertDialogTitle>Apply this employee import?</AlertDialogTitle>
                <AlertDialogDescription>
                  Creates {session.validationSummary.validRows} employee
                  {session.validationSummary.validRows === 1
                    ? ""
                    : "s"} from {session.sourceFileName}. Succeeds only if every
                  row can be written.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isApplying}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={isApplying}
                  onClick={handleConfirm}
                >
                  {isApplying ? <Spinner /> : <ClipboardCheck />}
                  Apply import
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

export function AppliedResultPanel({
  session,
  applyResult,
  onUpload,
  onReviewHistory,
}: {
  session: EmployeeImportSessionDto;
  applyResult: EmployeeImportApplyResultDto | null;
  onUpload: () => void;
  onReviewHistory: () => void;
}) {
  if (session.stage !== "Applied") {
    return null;
  }

  const createdCount =
    applyResult?.createdCount ?? session.validationSummary.validRows;
  const sourceRowCount = applyResult?.sourceRowCount ?? session.sourceRowCount;
  const appliedAt = applyResult?.appliedAt ?? session.appliedAt;

  return (
    <Card className="border-emerald-200 bg-emerald-50/70">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-emerald-200 bg-background/90 p-2">
            <CheckCircle2 className="size-5 text-emerald-600" />
          </div>
          <div className="space-y-1">
            <CardTitle>Import completed</CardTitle>
            <CardDescription>
              {createdCount} employee{createdCount === 1 ? "" : "s"} were
              created from {session.sourceFileName}.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <BatchMetaPill label="File" value={session.sourceFileName} />
          <BatchMetaPill label="Created" value={createdCount} />
          <BatchMetaPill label="Source rows" value={sourceRowCount} />
          <BatchMetaPill
            label="Applied"
            value={appliedAt ? formatTimestamp(appliedAt) : "Recorded"}
          />
        </div>

        <div className="grid gap-3 rounded-lg border border-emerald-200/80 bg-background/85 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="space-y-1 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">What next</p>
            <p>View the roster, start another batch, or check history below.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/employees">
                <Users />
                View employees
              </Link>
            </Button>
            <Button type="button" variant="outline" onClick={onUpload}>
              <Upload />
              Upload next CSV
            </Button>
            <Button type="button" variant="ghost" onClick={onReviewHistory}>
              <History />
              Review history
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function HistoryPagination({
  pageNumber,
  pageCount,
  totalCount,
  onPageChange,
}: {
  pageNumber: number;
  pageCount: number;
  totalCount: number;
  onPageChange: (pageNumber: number) => void;
}) {
  if (pageCount <= 1) {
    return (
      <p className="text-xs text-muted-foreground">
        {totalCount} import record{totalCount === 1 ? "" : "s"}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
      <p className="text-xs text-muted-foreground">
        Page {pageNumber} of {pageCount}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onPageChange(pageNumber - 1)}
          disabled={pageNumber === 1}
        >
          <ChevronLeft />
          Previous
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onPageChange(pageNumber + 1)}
          disabled={pageNumber === pageCount}
        >
          Next
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

function HistoryMetric({ label, value }: BatchMetaItem) {
  return (
    <div className="rounded-lg border bg-background/80 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function ImportHistoryListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-xl border bg-background p-4">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-52" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ImportHistoryDetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-16 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-16 rounded-xl" />
    </div>
  );
}

function ImportFieldReferenceSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border bg-muted/10 p-4">
      <Skeleton className="h-4 w-48" />
      <div className="grid gap-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function ImportHistoryPanel({
  historyPage,
  historyDetail,
  selectedHistoryId,
  isHistoryLoading,
  isHistoryDetailLoading,
  historyError,
  historyDetailError,
  onSelectHistory,
  onPageChange,
}: {
  historyPage?: EmployeeImportHistoryPageDto;
  historyDetail?: EmployeeImportHistoryDetailDto;
  selectedHistoryId: string | null;
  isHistoryLoading: boolean;
  isHistoryDetailLoading: boolean;
  historyError: unknown;
  historyDetailError: unknown;
  onSelectHistory: (historyId: string) => void;
  onPageChange: (pageNumber: number) => void;
}) {
  return (
    <Card id="employee-import-history" className="border-dashed">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="rounded-lg border bg-muted/20 p-2">
            <History className="size-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <CardTitle>Import history</CardTitle>
            <CardDescription>
              Applied batches for operational reference.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {historyError ? (
          <Alert variant="destructive">
            <AlertTitle>Import history failed to load</AlertTitle>
            <AlertDescription>{getErrorMessage(historyError)}</AlertDescription>
          </Alert>
        ) : null}

        {isHistoryLoading && !historyPage ? (
          <ImportHistoryListSkeleton />
        ) : historyPage && historyPage.items.length > 0 ? (
          <div className="space-y-3">
            <div className="grid gap-2">
              {historyPage.items.map((item, index) => {
                const isSelected = selectedHistoryId === item.id;
                const isLatest = index === 0 && historyPage.pageNumber === 1;
                const selectedDetail =
                  isSelected && historyDetail?.id === item.id
                    ? historyDetail
                    : null;

                return (
                  <div
                    key={item.id}
                    className={`overflow-hidden rounded-xl border transition-colors ${
                      isSelected
                        ? "border-foreground/20 bg-muted/25"
                        : "border-border bg-background"
                    }`}
                  >
                    <button
                      type="button"
                      className={`w-full cursor-pointer p-3 text-left transition-colors ${
                        isSelected
                          ? "bg-muted/20"
                          : "hover:border-foreground/15 hover:bg-muted/20"
                      }`}
                      onClick={() => onSelectHistory(item.id)}
                      aria-pressed={isSelected}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">
                            {item.sourceFileName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatTimestamp(item.appliedAt)} by{" "}
                            {item.actorFullName}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isLatest ? (
                            <Badge
                              variant="outline"
                              className="border-emerald-300 text-[10px] text-emerald-700"
                            >
                              Latest
                            </Badge>
                          ) : null}
                          <Badge variant={isSelected ? "secondary" : "outline"}>
                            {item.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{item.createdCount} created</span>
                        <span>{item.sourceRowCount} source rows</span>
                      </div>
                    </button>

                    {isSelected ? (
                      <div className="border-t bg-background/70 px-4 py-4">
                        {historyDetailError ? (
                          <Alert variant="destructive">
                            <AlertTitle>
                              History details failed to load
                            </AlertTitle>
                            <AlertDescription>
                              {getErrorMessage(historyDetailError)}
                            </AlertDescription>
                          </Alert>
                        ) : isHistoryDetailLoading || !selectedDetail ? (
                          <ImportHistoryDetailSkeleton />
                        ) : (
                          <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span>
                                Applied{" "}
                                {formatTimestamp(selectedDetail.appliedAt)}
                              </span>
                              <span>by {selectedDetail.actorFullName}</span>
                              <Badge
                                variant="outline"
                                className="py-0 text-[10px]"
                              >
                                {selectedDetail.actorRole}
                              </Badge>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                              <HistoryMetric
                                label="Valid rows"
                                value={selectedDetail.validRowCount}
                              />
                              <HistoryMetric
                                label="File size"
                                value={formatBytes(
                                  selectedDetail.sourceFileSizeBytes
                                )}
                              />
                              <HistoryMetric
                                label="Batch ID"
                                value={selectedDetail.sessionId.slice(0, 8)}
                              />
                              <HistoryMetric
                                label="Revision"
                                value={selectedDetail.version}
                              />
                            </div>

                            {selectedDetail.skippedCount > 0 ? (
                              <p className="text-xs text-muted-foreground">
                                {selectedDetail.skippedCount} row
                                {selectedDetail.skippedCount === 1
                                  ? " was"
                                  : "s were"}{" "}
                                skipped due to duplicate emails.
                              </p>
                            ) : null}

                            {selectedDetail.failureReason ? (
                              <Alert variant="destructive">
                                <AlertTitle>Failure reason</AlertTitle>
                                <AlertDescription>
                                  {selectedDetail.failureReason}
                                </AlertDescription>
                              </Alert>
                            ) : null}

                            {selectedDetail.unresolvedFollowUpIssues.length > 0 ? (
                              <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                                <div className="space-y-1">
                                  <p className="text-sm font-medium">
                                    Unresolved follow-up items
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Review the imported employees that still need
                                    attention and open the existing fixing surface.
                                  </p>
                                </div>

                                <div className="space-y-2">
                                  {selectedDetail.unresolvedFollowUpIssues.map(
                                    (issue) => {
                                      const fixHref = buildEmployeeFixHref({
                                        code: issue.code,
                                        label: issue.label,
                                        severity: "Attention",
                                        fieldKey: issue.fieldKey,
                                        fixTarget: issue.fixTarget,
                                      });

                                      return (
                                        <div
                                          key={issue.id}
                                          className="flex flex-col gap-3 rounded-lg border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                          <div className="space-y-1">
                                            <p className="text-sm font-medium text-foreground">
                                              {issue.label}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                              Row {issue.sourceRowNumber} • {" "}
                                              {issue.employeeFullName} ({" "}
                                              {issue.employeeEmail})
                                            </p>
                                          </div>

                                          {fixHref ? (
                                            <Button asChild size="sm" variant="outline">
                                              <Link href={fixHref}>Open fix</Link>
                                            </Button>
                                          ) : null}
                                        </div>
                                      );
                                    }
                                  )}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <HistoryPagination
              pageNumber={historyPage.pageNumber}
              pageCount={historyPage.pageCount}
              totalCount={historyPage.totalCount}
              onPageChange={onPageChange}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            No imports applied yet. Validate a clean batch and apply it to get
            started.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function EmptyImportState({
  isUploading,
  isDownloadingTemplate,
  onUpload,
  onDownloadTemplate,
}: {
  isUploading: boolean;
  isDownloadingTemplate: boolean;
  onUpload: () => void;
  onDownloadTemplate: () => void;
}) {
  return (
    <Card className="border-dashed">
      <CardContent>
        <div className="max-w-2xl space-y-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg border bg-muted/20 p-2">
              <FileSpreadsheet className="size-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">
                Upload your employee CSV
              </h2>
              <p className="text-sm text-muted-foreground">
                Download the template, upload the file, and validate before
                applying.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={onUpload} disabled={isUploading}>
              {isUploading ? <Spinner /> : <Upload />}
              Upload CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onDownloadTemplate}
              disabled={isDownloadingTemplate}
            >
              {isDownloadingTemplate ? <Spinner /> : <Download />}
              Download template
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Use the official template and keep column headers unchanged.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function getCategoryBadgeVariant(
  _category: EmployeeImportIssueGroup["category"]
) {
  return "destructive" as const;
}

function getNavigatorItemClassName(
  _category: EmployeeImportIssueGroup["category"],
  isActive: boolean
) {
  if (isActive) {
    return "border-destructive/40 bg-destructive/10 shadow-sm";
  }

  return "border-destructive/20 bg-background hover:border-destructive/30 hover:bg-destructive/5";
}

export function IssueNavigatorPanel({
  model,
  activeGroupKey,
  onSelectGroup,
}: {
  model: EmployeeImportValidationUiModel;
  activeGroupKey: string | null;
  onSelectGroup: (group: EmployeeImportIssueGroup) => void;
}) {
  return (
    <Card className="xl:sticky xl:top-6">
      <CardHeader className="pb-2">
        <CardTitle>Problems to fix</CardTitle>
        <CardDescription>
          Select a problem to narrow the preview to the affected rows.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1.5 xl:max-h-[calc(100vh-12rem)] xl:overflow-y-auto xl:pr-1">
        <div className="flex flex-wrap gap-2 pb-0.5">
          <Badge variant="outline">
            {model.groupCount} problem group{model.groupCount === 1 ? "" : "s"}
          </Badge>
          <Badge variant="outline">
            {model.affectedRowCount} affected row
            {model.affectedRowCount === 1 ? "" : "s"}
          </Badge>
        </div>

        <div className="grid gap-1.5">
          {model.groupedIssues.map((group) => {
            const isActive = activeGroupKey === group.key;

            return (
              <button
                key={group.key}
                type="button"
                className={`w-full max-w-full overflow-hidden cursor-pointer rounded-md border px-3 py-2 text-left transition-colors ${getNavigatorItemClassName(group.category, isActive)}`}
                onClick={() => onSelectGroup(group)}
                aria-pressed={isActive}
              >
                <div className="flex min-w-0 flex-wrap items-start gap-2 sm:flex-nowrap sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate text-sm font-medium leading-5">
                      {group.title}
                    </p>
                    <p className="line-clamp-2 wrap-break-word text-xs text-muted-foreground">
                      {group.fixHint}
                    </p>
                    {group.value ? (
                      <p className="truncate text-[11px] text-muted-foreground">
                        {group.value}
                      </p>
                    ) : null}
                  </div>
                  <Badge
                    variant="outline"
                    className="shrink-0 self-start whitespace-nowrap"
                  >
                    {group.rowNumbers.length} row
                    {group.rowNumbers.length === 1 ? "" : "s"}
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function SelectedIssueStrip({
  group,
  onJumpToRow,
}: {
  group: EmployeeImportIssueGroup | null;
  onJumpToRow: (rowNumber: number) => void;
}) {
  if (!group) {
    return (
      <div className="rounded-lg border bg-muted/10 p-3 text-sm text-muted-foreground">
        Select a problem to filter the preview to affected rows.
      </div>
    );
  }

  const visibleRowNumbers = group.rowNumbers.slice(
    0,
    MAX_VISIBLE_SELECTED_ROWS
  );
  const hiddenRowCount = Math.max(
    group.rowNumbers.length - visibleRowNumbers.length,
    0
  );

  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={getCategoryBadgeVariant(group.category)}>
              {group.categoryLabel}
            </Badge>
            <span className="text-sm font-medium">{group.title}</span>
          </div>
          {group.value && group.valueLabel ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {group.valueLabel}:
              </span>{" "}
              {group.value}
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">{group.fixHint}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {visibleRowNumbers.map((rowNumber) => (
            <Button
              key={`${group.key}-row-${rowNumber}`}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onJumpToRow(rowNumber)}
            >
              Row {rowNumber}
            </Button>
          ))}
        </div>
      </div>
      {hiddenRowCount > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {hiddenRowCount} more affected row
          {hiddenRowCount === 1 ? " is" : "s are"} available in this problem
          group.
        </p>
      ) : null}
    </div>
  );
}

function getVisiblePreviewPageNumbers(currentPage: number, pageCount: number) {
  if (pageCount <= 5) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  let startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(pageCount, startPage + 4);
  startPage = Math.max(1, endPage - 4);

  return Array.from(
    { length: endPage - startPage + 1 },
    (_, index) => startPage + index
  );
}

export function PreviewPagination({
  pageNumber,
  pageCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  pageNumber: number;
  pageCount: number;
  pageSize: number;
  onPageChange: (pageNumber: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
}) {
  const normalizedPageCount = Math.max(pageCount, 1);
  const normalizedPageNumber = Math.min(
    Math.max(pageNumber, 1),
    normalizedPageCount
  );
  const pageNumbers = getVisiblePreviewPageNumbers(
    normalizedPageNumber,
    normalizedPageCount
  );
  const firstVisiblePage = pageNumbers[0] ?? 1;
  const lastVisiblePage =
    pageNumbers[pageNumbers.length - 1] ?? normalizedPageCount;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Rows</span>
        <Select
          value={String(pageSize)}
          onValueChange={(value) => onPageSizeChange(Number(value) as PageSize)}
        >
          <SelectTrigger className="h-8 w-18">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Previous preview page"
          onClick={() => onPageChange(normalizedPageNumber - 1)}
          disabled={normalizedPageNumber <= 1}
        >
          <ChevronLeft className="size-3.5" />
        </Button>

        {normalizedPageCount > 5 && firstVisiblePage > 1 ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onPageChange(1)}
            >
              1
            </Button>
            <span className="px-1 text-xs text-muted-foreground">...</span>
          </>
        ) : null}

        {pageNumbers.map((page) => {
          const isCurrentPage = page === normalizedPageNumber;

          return (
            <Button
              key={page}
              type="button"
              size="sm"
              variant={isCurrentPage ? "secondary" : "ghost"}
              className="min-w-8"
              onClick={() => onPageChange(page)}
              aria-current={isCurrentPage ? "page" : undefined}
            >
              {page}
            </Button>
          );
        })}

        {normalizedPageCount > 5 && lastVisiblePage < normalizedPageCount ? (
          <>
            <span className="px-1 text-xs text-muted-foreground">...</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onPageChange(normalizedPageCount)}
            >
              {normalizedPageCount}
            </Button>
          </>
        ) : null}

        <span className="px-2 text-xs tabular-nums text-muted-foreground">
          {normalizedPageNumber} / {normalizedPageCount}
        </span>

        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Next preview page"
          onClick={() => onPageChange(normalizedPageNumber + 1)}
          disabled={normalizedPageNumber >= normalizedPageCount}
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function SecondaryDetailsPanel({
  session,
  activeHeaders,
  activeSchema,
  isSchemaLoading,
}: {
  session?: EmployeeImportSessionDto | null;
  activeHeaders: string[];
  activeSchema?: EmployeeImportSessionDto["employeeImportSchema"];
  isSchemaLoading: boolean;
}) {
  const shouldExpandSecondaryDetailsByDefault =
    !!session && session.stage !== "Applied";
  const [isRawRowsOpen, setIsRawRowsOpen] = useState(
    shouldExpandSecondaryDetailsByDefault
  );
  const [isFieldReferenceOpen, setIsFieldReferenceOpen] = useState(
    shouldExpandSecondaryDetailsByDefault
  );

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>Reference details</CardTitle>
        <CardDescription>
          Raw upload preview and template field reference.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {session ? (
          <details
            className="rounded-lg border bg-muted/10"
            open={isRawRowsOpen}
            onToggle={(event) => setIsRawRowsOpen(event.currentTarget.open)}
          >
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">
              Raw uploaded rows ({session.sampleRows.length} shown)
            </summary>
            <div className="overflow-x-auto border-t">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    {activeHeaders.map((header) => (
                      <TableHead key={header} className="font-mono text-xs">
                        {header}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {session.sampleRows.map((row) => (
                    <TableRow key={row.rowNumber}>
                      <TableCell>{row.rowNumber}</TableCell>
                      {activeHeaders.map((header) => (
                        <TableCell key={`${row.rowNumber}-${header}`}>
                          {row.values[header] ?? (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </details>
        ) : null}

        {isSchemaLoading && !activeSchema ? (
          <ImportFieldReferenceSkeleton />
        ) : (
          <details
            className="rounded-lg border bg-muted/10"
            open={isFieldReferenceOpen}
            onToggle={(event) =>
              setIsFieldReferenceOpen(event.currentTarget.open)
            }
          >
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">
              Template field reference (
              {activeSchema?.canonicalFields.length ?? 0})
            </summary>
            <div className="overflow-x-auto border-t">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Header</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Requirement</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Example</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeSchema?.canonicalFields.map((field) => (
                    <TableRow key={field.key}>
                      <TableCell className="font-mono text-xs">
                        {field.key}
                      </TableCell>
                      <TableCell>{field.displayLabel}</TableCell>
                      <TableCell>
                        <Badge
                          variant={field.required ? "secondary" : "outline"}
                        >
                          {field.required ? "Required" : "Optional"}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-normal text-muted-foreground">
                        {field.description}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {field.example}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
