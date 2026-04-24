"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  RefreshCcw,
  Upload,
  Users,
} from "lucide-react";
import { ApiError } from "@repo/api";
import { useAuth } from "@repo/auth";
import { EmptyState } from "@repo/ui";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { canAccessEmployeeRoster } from "@/lib/employee-roster-access";
import type {
  EmployeeImportPreviewFilter,
  EmployeeImportPreviewRowDto,
  EmployeeImportSessionDto,
} from "./employee-import.types";
import {
  buildEmployeeImportValidationUiModel,
  type EmployeeImportIssueGroup,
  type EmployeeImportValidationUiModel,
} from "./employee-import-validation";
import {
  useDownloadEmployeeImportTemplate,
  useEmployeeImportSchema,
  useEmployeeImportSession,
  useUploadEmployeeImport,
  useValidateEmployeeImport,
} from "./use-employee-import";

const PREVIEW_COLUMNS: Array<{
  key: keyof EmployeeImportPreviewRowDto;
  label: string;
}> = [
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "email", label: "Email" },
  { key: "hireDate", label: "Hire date" },
  { key: "jobTitle", label: "Job title" },
  { key: "orgUnitCode", label: "Org unit code" },
  { key: "managerEmail", label: "Manager email" },
];

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

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.errors.join(", ");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred.";
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

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
        "This batch is clean. Keep it unless the source data changes and you need to upload a replacement.",
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

function getPreviewDescription(session: EmployeeImportSessionDto) {
  if (
    session.stage === "Validated" &&
    session.validationSummary.errorCount > 0
  ) {
    return "Use the normalized preview to inspect the rows that need to be fixed in the source CSV.";
  }

  if (session.stage === "Validated") {
    return "This is the normalized view of the validated batch.";
  }

  if (session.stage === "Expired") {
    return "This is the last normalized preview from the expired batch.";
  }

  return "Review the normalized preview, then validate the batch.";
}

function BatchMetaPill({ label, value }: BatchMetaItem) {
  return (
    <div className="rounded-full border bg-background/80 px-3 py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>{" "}
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function BatchStatusPanel({
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

function EmptyImportState({
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
                Start with the official template, upload the file, and validate
                the batch before you rely on it.
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
            Use the official template only and keep the header order unchanged.
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

function IssueNavigatorPanel({
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
                  <Badge variant="outline" className="shrink-0 self-start whitespace-nowrap">
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

function SelectedIssueStrip({
  group,
  onJumpToRow,
}: {
  group: EmployeeImportIssueGroup | null;
  onJumpToRow: (rowNumber: number) => void;
}) {
  if (!group) {
    return (
      <div className="rounded-lg border bg-muted/10 p-3 text-sm text-muted-foreground">
        Select a problem from the navigator to narrow the preview and inspect
        the affected rows.
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

function PreviewPagination({
  pageNumber,
  pageSize,
  pageCount,
  totalRows,
  onPageChange,
}: {
  pageNumber: number;
  pageSize: number;
  pageCount: number;
  totalRows: number;
  onPageChange: (pageNumber: number) => void;
}) {
  if (pageCount <= 1) {
    return null;
  }

  const pageNumbers = getVisiblePreviewPageNumbers(pageNumber, pageCount);
  const firstVisiblePage = pageNumbers[0] ?? 1;
  const lastVisiblePage = pageNumbers[pageNumbers.length - 1] ?? pageCount;
  const startRow = totalRows === 0 ? 0 : (pageNumber - 1) * pageSize + 1;
  const endRow =
    totalRows === 0 ? 0 : Math.min(pageNumber * pageSize, totalRows);

  return (
    <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        Rows {startRow}-{endRow} of {totalRows}
      </p>

      <div className="flex flex-wrap items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onPageChange(pageNumber - 1)}
          disabled={pageNumber === 1}
        >
          <ChevronLeft />
          Previous
        </Button>

        {firstVisiblePage > 1 ? (
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
          const isCurrentPage = page === pageNumber;

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

        {lastVisiblePage < pageCount ? (
          <>
            <span className="px-1 text-xs text-muted-foreground">...</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onPageChange(pageCount)}
            >
              {pageCount}
            </Button>
          </>
        ) : null}

        <Button
          type="button"
          size="sm"
          variant="ghost"
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

function SecondaryDetailsPanel({
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
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>Secondary details</CardTitle>
        <CardDescription>
          Inspect the original upload or the template field definitions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {session ? (
          <details className="rounded-lg border bg-muted/10" open>
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
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            Loading employee import schema...
          </div>
        ) : (
          <details className="rounded-lg border bg-muted/10" open>
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

export default function EmployeeImportPage() {
  const { user } = useAuth();
  const canAccess = canAccessEmployeeRoster(user);
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sessionId = searchParams.get("session");
  const [previewFilter, setPreviewFilter] =
    useState<EmployeeImportPreviewFilter>("all");
  const [activeIssueGroupKey, setActiveIssueGroupKey] = useState<string | null>(
    null
  );
  const [currentPreviewPage, setCurrentPreviewPage] = useState(1);
  const [pendingScrollRowNumber, setPendingScrollRowNumber] = useState<
    number | null
  >(null);

  const {
    data: schema,
    error: schemaError,
    isLoading: isSchemaLoading,
  } = useEmployeeImportSchema();
  const {
    data: session,
    error: sessionError,
    isLoading: isSessionLoading,
    refetch: refetchSession,
  } = useEmployeeImportSession(sessionId, {
    pageNumber: currentPreviewPage,
    previewFilter,
    groupKey: activeIssueGroupKey,
  });
  const uploadImport = useUploadEmployeeImport();
  const validateImport = useValidateEmployeeImport();
  const downloadTemplate = useDownloadEmployeeImportTemplate();

  const activeSchema = session?.employeeImportSchema ?? schema;
  const canonicalFieldKeys =
    activeSchema?.canonicalFields.map((field) => field.key) ?? [];
  const activeHeaders = (session?.sourceHeaders ?? canonicalFieldKeys).filter(
    (header) => canonicalFieldKeys.includes(header)
  );
  const validationUi = useMemo(
    () => (session ? buildEmployeeImportValidationUiModel(session) : null),
    [session]
  );
  const issueSummary = validationUi
    ? {
        groupCount: validationUi.groupCount,
        rawIssueCount: validationUi.rawIssueCount,
        affectedRowCount: validationUi.affectedRowCount,
      }
    : null;
  const hasGroupedIssues =
    session?.stage === "Validated" && (validationUi?.groupCount ?? 0) > 0;
  const focusedGroup = useMemo(
    () =>
      activeIssueGroupKey && validationUi
        ? (validationUi.groupedIssues.find(
            (group) => group.key === activeIssueGroupKey
          ) ?? null)
        : null,
    [activeIssueGroupKey, validationUi]
  );
  const displayedPreviewRows = session?.previewRows ?? [];
  const previewRangeStart =
    session && session.totalPreviewRowCount > 0
      ? (session.previewPageNumber - 1) * session.previewPageSize + 1
      : 0;
  const previewRangeEnd =
    session && session.totalPreviewRowCount > 0
      ? previewRangeStart + displayedPreviewRows.length - 1
      : 0;
  const previewFooterPrimary = session
    ? focusedGroup
      ? session.totalPreviewRowCount > 0
        ? `Showing rows ${previewRangeStart}-${previewRangeEnd} of ${session.totalPreviewRowCount} for the selected problem`
        : "No preview rows match the selected problem."
      : hasGroupedIssues && previewFilter === "affected"
        ? session.totalPreviewRowCount > 0
          ? `Showing rows ${previewRangeStart}-${previewRangeEnd} of ${session.totalPreviewRowCount} affected row(s)`
          : "No rows with issues match the current preview."
        : session.totalPreviewRowCount > 0
          ? `Showing rows ${previewRangeStart}-${previewRangeEnd} of ${session.totalPreviewRowCount}`
          : "No rows are available in this preview."
    : "";
  const previewFooterSecondary = session
    ? session.previewPageCount > 1
      ? `Page ${session.previewPageNumber} of ${session.previewPageCount}`
      : session.totalPreviewRowCount > 0
        ? "All matching rows are visible on one page."
        : "Adjust the filter to inspect a different row set."
    : "";

  useEffect(() => {
    setPreviewFilter(hasGroupedIssues ? "affected" : "all");
    setActiveIssueGroupKey(null);
    setCurrentPreviewPage(1);
    setPendingScrollRowNumber(null);
  }, [hasGroupedIssues, session?.id]);

  const handleBrowse = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDownloadTemplate = useCallback(async () => {
    try {
      const blob = await downloadTemplate.mutateAsync(undefined);
      downloadBlob(blob, "employee-import-template.csv");
      toast.success("Employee import template downloaded.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }, [downloadTemplate]);

  const handleFileSelected = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file) {
        return;
      }

      try {
        const nextSession = await uploadImport.mutateAsync(file);
        router.replace(`/employees/import?session=${nextSession.id}`);
        toast.success("Employee import preview created.");
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    },
    [router, uploadImport]
  );

  const handleValidateSession = useCallback(async () => {
    if (!session) {
      return;
    }

    try {
      await validateImport.mutateAsync({
        sessionId: session.id,
        pageNumber: currentPreviewPage,
        previewFilter,
        groupKey: activeIssueGroupKey,
      });
      await refetchSession();

      if (session.stage === "Validated") {
        toast.success("Employee import validation refreshed.");
      } else {
        toast.success("Employee import validation completed.");
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }, [
    activeIssueGroupKey,
    currentPreviewPage,
    previewFilter,
    refetchSession,
    session,
    validateImport,
  ]);

  const scrollToPreviewRow = useCallback((rowNumber: number) => {
    requestAnimationFrame(() => {
      document
        .getElementById(`employee-import-preview-row-${rowNumber}`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    if (pendingScrollRowNumber === null || !session) {
      return;
    }

    const rowExists = session.previewRows.some(
      (row) => row.rowNumber === pendingScrollRowNumber
    );

    if (!rowExists) {
      return;
    }

    scrollToPreviewRow(pendingScrollRowNumber);
    setPendingScrollRowNumber(null);
  }, [pendingScrollRowNumber, scrollToPreviewRow, session]);

  const handleSelectGroup = useCallback(
    (group: EmployeeImportIssueGroup) => {
      const isSameGroup = activeIssueGroupKey === group.key;
      setPreviewFilter("affected");
      setCurrentPreviewPage(1);

      if (isSameGroup) {
        setActiveIssueGroupKey(null);
        setPendingScrollRowNumber(null);
        return;
      }

      setActiveIssueGroupKey(group.key);
      const firstPreviewRow = group.rowNumbers[0];

      if (firstPreviewRow !== undefined) {
        setPendingScrollRowNumber(firstPreviewRow);
      }
    },
    [activeIssueGroupKey]
  );

  const handleJumpToRow = useCallback(
    (rowNumber: number) => {
      const pageSize = session?.previewPageSize ?? 25;
      const sortedRowNumbers = focusedGroup?.rowNumbers
        ? [...focusedGroup.rowNumbers].sort((left, right) => left - right)
        : [];
      const targetRowIndex =
        sortedRowNumbers.findIndex(
          (candidateRowNumber) => candidateRowNumber === rowNumber
        );

      if (targetRowIndex >= 0) {
        setCurrentPreviewPage(Math.floor(targetRowIndex / pageSize) + 1);
        setPendingScrollRowNumber(rowNumber);
        return;
      }

      scrollToPreviewRow(rowNumber);
    },
    [focusedGroup, scrollToPreviewRow, session?.previewPageSize]
  );

  const handlePreviewFilterChange = useCallback(
    (nextPreviewFilter: EmployeeImportPreviewFilter) => {
      setPreviewFilter(nextPreviewFilter);
      setActiveIssueGroupKey(null);
      setCurrentPreviewPage(1);
      setPendingScrollRowNumber(null);
    },
    []
  );

  const handlePreviewPageChange = useCallback(
    (nextPageNumber: number) => {
      if (!session) {
        return;
      }

      const clampedPageNumber = Math.min(
        Math.max(nextPageNumber, 1),
        session.previewPageCount
      );

      if (clampedPageNumber === currentPreviewPage) {
        return;
      }

      setCurrentPreviewPage(clampedPageNumber);
      setPendingScrollRowNumber(null);
      requestAnimationFrame(() => {
        document
          .getElementById("employee-import-preview")
          ?.scrollIntoView({ block: "start", behavior: "smooth" });
      });
    },
    [currentPreviewPage, session]
  );

  if (!canAccess) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader
          title="Import employees"
          description="Employee import is available only to tenant HR administrators after setup is complete."
        />
        <EmptyState
          icon={Users}
          title="Employee import is not available for this role"
          description="Ask a tenant HR administrator to manage employee imports from the Employees workspace."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 [&_button:not(:disabled)]:cursor-pointer [&_button:disabled]:cursor-not-allowed [&_summary]:cursor-pointer">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFileSelected}
      />

      <PageHeader
        title="Import employees"
        description="Upload and validate employees in bulk with the official CSV template."
        actions={
          <Button variant="outline" asChild>
            <Link href="/employees">
              <ArrowLeft />
              Back to employees
            </Link>
          </Button>
        }
      />

      {(schemaError || sessionError) && (
        <Alert variant="destructive">
          <AlertTitle>Employee import request failed</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{getErrorMessage(schemaError ?? sessionError)}</span>
            {sessionId ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchSession()}
              >
                <RefreshCcw />
                Retry session
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      )}

      {isSessionLoading && sessionId && !session ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Spinner />
            Loading employee import session...
          </CardContent>
        </Card>
      ) : null}

      {session ? (
        <>
          <BatchStatusPanel
            session={session}
            isValidating={validateImport.isLoading}
            isUploading={uploadImport.isLoading}
            isDownloadingTemplate={downloadTemplate.isLoading}
            issueSummary={issueSummary}
            onValidate={handleValidateSession}
            onUpload={handleBrowse}
            onDownloadTemplate={handleDownloadTemplate}
          />

          <div
            className={
              hasGroupedIssues && validationUi
                ? "grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)] xl:items-start"
                : "grid gap-4"
            }
          >
            {hasGroupedIssues && validationUi ? (
              <IssueNavigatorPanel
                model={validationUi}
                activeGroupKey={activeIssueGroupKey}
                onSelectGroup={handleSelectGroup}
              />
            ) : null}

            <Card id="employee-import-preview">
              <CardHeader className="gap-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle>Normalized preview</CardTitle>
                    <CardDescription>
                      {getPreviewDescription(session)}
                    </CardDescription>
                  </div>
                  {hasGroupedIssues ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          previewFilter === "all" ? "default" : "outline"
                        }
                        onClick={() => handlePreviewFilterChange("all")}
                      >
                        All rows
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          previewFilter === "affected" ? "default" : "outline"
                        }
                        onClick={() => handlePreviewFilterChange("affected")}
                      >
                        Rows with issues only
                      </Button>
                    </div>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent>
                {hasGroupedIssues ? (
                  <div className="mb-4">
                    <SelectedIssueStrip
                      group={focusedGroup}
                      onJumpToRow={handleJumpToRow}
                    />
                  </div>
                ) : null}

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        {hasGroupedIssues ? (
                          <TableHead>Issues</TableHead>
                        ) : null}
                        {PREVIEW_COLUMNS.map((column) => (
                          <TableHead
                            key={column.key}
                            className={
                              focusedGroup?.fieldKeys.includes(column.key)
                                ? "bg-destructive/10"
                                : undefined
                            }
                          >
                            {column.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedPreviewRows.length > 0 ? (
                        displayedPreviewRows.map((row) => {
                          const rowGroups =
                            validationUi?.groupsByRowNumber.get(
                              row.rowNumber
                            ) ?? [];
                          const hasRowIssues = rowGroups.length > 0;
                          const isActiveRow =
                            !!activeIssueGroupKey &&
                            rowGroups.some(
                              (group) => group.key === activeIssueGroupKey
                            );

                          return (
                            <TableRow
                              key={row.rowNumber}
                              id={`employee-import-preview-row-${row.rowNumber}`}
                              className={
                                hasRowIssues
                                  ? isActiveRow
                                    ? "bg-destructive/10"
                                    : "bg-destructive/5"
                                  : undefined
                              }
                            >
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {hasRowIssues ? (
                                    <span className="size-2 rounded-full bg-destructive" />
                                  ) : null}
                                  <span>{row.rowNumber}</span>
                                </div>
                              </TableCell>
                              {hasGroupedIssues ? (
                                <TableCell className="max-w-56">
                                  <div className="flex flex-wrap gap-1">
                                    {rowGroups.length > 0 ? (
                                      rowGroups.map((group) => (
                                        <button
                                          key={`${row.rowNumber}-${group.key}`}
                                          type="button"
                                          className={`cursor-pointer rounded-full border px-2 py-0.5 text-xs ${
                                            activeIssueGroupKey === group.key
                                              ? "border-destructive bg-destructive/10 text-destructive"
                                              : "border-destructive/20 bg-background text-destructive/80 hover:bg-destructive/5"
                                          }`}
                                          onClick={() =>
                                            handleSelectGroup(group)
                                          }
                                          aria-pressed={
                                            activeIssueGroupKey === group.key
                                          }
                                        >
                                          {group.shortLabel}
                                        </button>
                                      ))
                                    ) : (
                                      <span className="text-muted-foreground">
                                        -
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                              ) : null}
                              {PREVIEW_COLUMNS.map((column) => (
                                <TableCell
                                  key={`${row.rowNumber}-${column.key}`}
                                  className={
                                    focusedGroup?.fieldKeys.includes(column.key)
                                      ? isActiveRow
                                        ? "bg-destructive/10"
                                        : "bg-destructive/5"
                                      : undefined
                                  }
                                >
                                  {row[column.key] ?? (
                                    <span className="text-muted-foreground">
                                      -
                                    </span>
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={
                              PREVIEW_COLUMNS.length +
                              1 +
                              (hasGroupedIssues ? 1 : 0)
                            }
                            className="py-8 text-center text-sm text-muted-foreground"
                          >
                            No rows match the current preview filter.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                <PreviewPagination
                  pageNumber={session.previewPageNumber}
                  pageSize={session.previewPageSize}
                  pageCount={session.previewPageCount}
                  totalRows={session.totalPreviewRowCount}
                  onPageChange={handlePreviewPageChange}
                />
              </CardContent>
              <CardFooter className="justify-between gap-4 text-xs text-muted-foreground">
                <span>{previewFooterPrimary}</span>
                <span>{previewFooterSecondary}</span>
              </CardFooter>
            </Card>
          </div>

          <SecondaryDetailsPanel
            session={session}
            activeHeaders={activeHeaders}
            activeSchema={activeSchema}
            isSchemaLoading={isSchemaLoading}
          />
        </>
      ) : (
        <>
          <EmptyImportState
            isUploading={uploadImport.isLoading}
            isDownloadingTemplate={downloadTemplate.isLoading}
            onUpload={handleBrowse}
            onDownloadTemplate={handleDownloadTemplate}
          />

          <SecondaryDetailsPanel
            activeHeaders={activeHeaders}
            activeSchema={activeSchema}
            isSchemaLoading={isSchemaLoading}
          />
        </>
      )}
    </div>
  );
}
