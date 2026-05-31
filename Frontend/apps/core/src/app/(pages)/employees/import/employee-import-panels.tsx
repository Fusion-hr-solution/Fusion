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
  ShieldCheck,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import { PAGE_SIZE_OPTIONS, type PageSize } from "@repo/ui";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
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
  ImportHistoryEventType,
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
import { cn } from "@/lib/utils";
import { buildEmployeeFixHref } from "../employee-readiness";

const MAX_VISIBLE_SELECTED_ROWS = 12;

type BatchMetaItem = {
  label: string;
  value: string | number;
};

type ImportWorkflowStepState = "complete" | "current" | "upcoming" | "blocked";

type ImportWorkflowStep = {
  key: "upload" | "validate" | "import";
  title: string;
  statusLabel: string;
  state: ImportWorkflowStepState;
  icon: LucideIcon;
  isLoading?: boolean;
};

function getBatchMetaItems(session: EmployeeImportSessionDto): BatchMetaItem[] {
  return [
    { label: "Rows", value: session.sourceRowCount },
    { label: "Size", value: formatBytes(session.sourceFileSizeBytes) },
    { label: "Expires", value: formatTimestamp(session.expiresAt) },
  ];
}

function getWorkflowStatusLabel({
  session,
  isValidating,
  isApplying,
}: {
  session: EmployeeImportSessionDto;
  isValidating: boolean;
  isApplying: boolean;
}): {
  label: string;
  variant: "default" | "secondary" | "outline" | "destructive";
  cardClassName: string;
} {
  if (session.stage === "Expired") {
    return {
      label: "Expired",
      variant: "destructive",
      cardClassName: "border-destructive/30 bg-destructive/5",
    };
  }
  if (isApplying) {
    return {
      label: "Importing",
      variant: "default",
      cardClassName: "border-amber-200 bg-amber-50/70",
    };
  }
  if (
    session.stage === "Validated" &&
    session.validationSummary.errorCount > 0
  ) {
    return {
      label: "Blocked",
      variant: "destructive",
      cardClassName: "border-destructive/30 bg-destructive/5",
    };
  }
  if (session.stage === "Validated") {
    return {
      label: "Ready to import",
      variant: "secondary",
      cardClassName: "border-emerald-200 bg-emerald-50/70",
    };
  }
  if (isValidating) {
    return {
      label: "Validating",
      variant: "outline",
      cardClassName: "border-primary/20 bg-primary/5",
    };
  }
  return {
    label: "Preview ready",
    variant: "outline",
    cardClassName: "border-border bg-card",
  };
}

function getWorkflowSteps({
  session,
  isValidating,
  isApplying,
}: {
  session: EmployeeImportSessionDto;
  isValidating: boolean;
  isApplying: boolean;
}): ImportWorkflowStep[] {
  if (session.stage === "Expired") {
    return [
      {
        key: "upload",
        title: "Upload file",
        statusLabel: "Upload again",
        state: "current",
        icon: Upload,
      },
      {
        key: "validate",
        title: "Validate data",
        statusLabel: "Later",
        state: "upcoming",
        icon: Eye,
      },
      {
        key: "import",
        title: "Import employees",
        statusLabel: "Later",
        state: "upcoming",
        icon: Users,
      },
    ];
  }

  if (
    session.stage === "Validated" &&
    session.validationSummary.errorCount > 0
  ) {
    return [
      {
        key: "upload",
        title: "Upload file",
        statusLabel: "Done",
        state: "complete",
        icon: Upload,
      },
      {
        key: "validate",
        title: "Validate data",
        statusLabel: `${session.validationSummary.errorCount} issue${session.validationSummary.errorCount === 1 ? "" : "s"}${session.validationSummary.warningCount > 0 ? ` · ${session.validationSummary.warningCount} warning${session.validationSummary.warningCount === 1 ? "" : "s"}` : ""}`,
        state: "blocked",
        icon: Eye,
      },
      {
        key: "import",
        title: "Import employees",
        statusLabel: "Blocked",
        state: "upcoming",
        icon: Users,
      },
    ];
  }

  if (session.stage === "Validated") {
    const validatedLabel =
      session.validationSummary.warningCount > 0
        ? `${session.validationSummary.validRows} ready · ${session.validationSummary.warningCount} warning${session.validationSummary.warningCount === 1 ? "" : "s"}`
        : `${session.validationSummary.validRows} ready`;
    return [
      {
        key: "upload",
        title: "Upload file",
        statusLabel: "Done",
        state: "complete",
        icon: Upload,
      },
      {
        key: "validate",
        title: "Validate data",
        statusLabel: validatedLabel,
        state: "complete",
        icon: Eye,
      },
      {
        key: "import",
        title: "Import employees",
        statusLabel: isApplying ? "Running" : "Ready",
        state: "current",
        icon: Users,
        isLoading: isApplying,
      },
    ];
  }

  return [
    {
      key: "upload",
      title: "Upload file",
      statusLabel: "Done",
      state: "complete",
      icon: Upload,
    },
    {
      key: "validate",
      title: "Validate data",
      statusLabel: isValidating ? "Running" : "Start here",
      state: "current",
      icon: Eye,
      isLoading: isValidating,
    },
    {
      key: "import",
      title: "Import employees",
      statusLabel: "Later",
      state: "upcoming",
      icon: Users,
    },
  ];
}

function getCompletedSteps(): ImportWorkflowStep[] {
  return [
    {
      key: "upload",
      title: "Upload file",
      statusLabel: "Done",
      state: "complete",
      icon: Upload,
    },
    {
      key: "validate",
      title: "Validate data",
      statusLabel: "Done",
      state: "complete",
      icon: Eye,
    },
    {
      key: "import",
      title: "Import employees",
      statusLabel: "Done",
      state: "complete",
      icon: Users,
    },
  ];
}

function getStepStyle(state: ImportWorkflowStepState) {
  switch (state) {
    case "complete":
      return {
        cell: "bg-emerald-50/70 dark:bg-emerald-950/20",
        node: "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-300",
        status: "text-emerald-700 dark:text-emerald-300",
      };
    case "current":
      return {
        cell: "bg-primary/5",
        node: "border-primary/20 bg-primary/10 text-primary",
        status: "text-primary",
      };
    case "blocked":
      return {
        cell: "bg-destructive/5",
        node: "border-destructive/20 bg-destructive/10 text-destructive",
        status: "text-destructive",
      };
    default:
      return {
        cell: "bg-background",
        node: "border-border bg-muted/60 text-muted-foreground",
        status: "text-muted-foreground",
      };
  }
}

function BatchMetaPill({ label, value }: BatchMetaItem) {
  return (
    <div className="rounded-full border bg-background/80 px-3 py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>{" "}
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function ImportWorkflowSteps({ steps }: { steps: ImportWorkflowStep[] }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-background/85">
      <div className="grid md:grid-cols-3">
        {steps.map((step, index) => {
          const Icon = step.state === "complete" ? CheckCircle2 : step.icon;
          const style = getStepStyle(step.state);

          return (
            <div
              key={step.key}
              className={cn(
                "flex items-center gap-3 px-4 py-3",
                style.cell,
                index < steps.length - 1
                  ? "border-b md:border-r md:border-b-0"
                  : undefined
              )}
              aria-current={step.state === "current" ? "step" : undefined}
            >
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border",
                  style.node
                )}
              >
                {step.isLoading ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <Icon className="size-4" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {step.title}
                </p>
                <p className={cn("text-xs", style.status)}>
                  {step.statusLabel}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BatchActionPanel({
  session,
  isValidating,
  isUploading,
  isDownloadingTemplate,
  isApplying,
  applyError,
  onValidate,
  onUpload,
  onDownloadTemplate,
  onApply,
}: {
  session: EmployeeImportSessionDto;
  isValidating: boolean;
  isUploading: boolean;
  isDownloadingTemplate: boolean;
  isApplying: boolean;
  applyError: string | null;
  onValidate: () => void;
  onUpload: () => void;
  onDownloadTemplate: () => void;
  onApply: () => Promise<boolean>;
}) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const statusMeta = getWorkflowStatusLabel({
    session,
    isValidating,
    isApplying,
  });
  const isValidated = session.stage === "Validated";
  const hasErrors = session.validationSummary.errorCount > 0;
  const isExpired = session.stage === "Expired";
  const isReadyToImport = isValidated && !hasErrors;
  const isActionLocked = isValidating || isApplying || isUploading;
  const metaItems = getBatchMetaItems(session);
  const steps = getWorkflowSteps({ session, isValidating, isApplying });
  const statusIcon = isApplying ? (
    <Users className="size-4 text-amber-700" />
  ) : isValidated && !hasErrors ? (
    <CheckCircle2 className="size-4 text-emerald-600" />
  ) : !isValidated && !isExpired ? (
    <Eye className="size-4 text-muted-foreground" />
  ) : (
    <AlertCircle className="size-4 text-destructive" />
  );

  const handleConfirm = async () => {
    const didApply = await onApply();
    if (didApply) {
      setIsConfirmOpen(false);
    }
  };

  return (
    <Card className={statusMeta.cardClassName}>
      <CardHeader className="gap-3 ">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background/90">
              {statusIcon}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
              </div>
              <CardTitle className="break-all text-base sm:text-lg">
                {session.sourceFileName}
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                {metaItems.map((item) => (
                  <BatchMetaPill key={item.label} {...item} />
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {isReadyToImport ? (
              <AlertDialog
                open={isConfirmOpen}
                onOpenChange={(open) => {
                  if (!isApplying) {
                    setIsConfirmOpen(open);
                  }
                }}
              >
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    disabled={!session.canApply || isApplying}
                  >
                    {isApplying ? <Spinner /> : <ClipboardCheck />}
                    {isApplying ? "Importing employees" : "Import employees"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogMedia>
                      <ShieldCheck className="size-5 text-amber-700" />
                    </AlertDialogMedia>
                    <AlertDialogTitle>Import these employees?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Creates {session.validationSummary.validRows} employee
                      {session.validationSummary.validRows === 1
                        ? ""
                        : "s"}{" "}
                      from {session.sourceFileName}.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  {applyError ? (
                    <Alert variant="destructive">
                      <AlertTitle>Import failed</AlertTitle>
                      <AlertDescription>
                        <div className="space-y-1">
                          <p>{applyError}</p>
                          <p>
                            Revalidate or upload a corrected file before
                            retrying.
                          </p>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isApplying}>
                      Cancel
                    </AlertDialogCancel>
                    <Button
                      type="button"
                      disabled={isApplying}
                      onClick={handleConfirm}
                    >
                      {isApplying ? <Spinner /> : <ClipboardCheck />}
                      {isApplying ? "Importing employees" : "Import employees"}
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : hasErrors || isExpired ? (
              <Button
                type="button"
                onClick={onUpload}
                disabled={isActionLocked}
              >
                {isUploading ? <Spinner /> : <Upload />}
                {hasErrors ? "Upload corrected file" : "Upload file again"}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={onValidate}
                disabled={!session.canValidate || isActionLocked}
              >
                {isValidating ? <Spinner /> : <Eye />}
                {isValidating ? "Validating file" : "Validate file"}
              </Button>
            )}

            {!isExpired && !hasErrors ? (
              <Button
                type="button"
                variant="outline"
                onClick={onUpload}
                disabled={isActionLocked}
              >
                {isUploading ? <Spinner /> : <Upload />}
                Upload another file
              </Button>
            ) : null}

            {!isReadyToImport ? (
              <Button
                type="button"
                variant="ghost"
                onClick={onDownloadTemplate}
                disabled={
                  isDownloadingTemplate ||
                  isValidating ||
                  isApplying ||
                  isUploading
                }
              >
                {isDownloadingTemplate ? <Spinner /> : <Download />}
                Download template
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        <ImportWorkflowSteps steps={steps} />

        {applyError && !isConfirmOpen ? (
          <Alert variant="destructive">
            <AlertTitle>Import failed</AlertTitle>
            <AlertDescription>
              <div className="space-y-1">
                <p>{applyError}</p>
                <p>Revalidate or upload a corrected file before retrying.</p>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}
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
  const needsAccessCount = createdCount;

  return (
    <Card className="border-emerald-200 bg-emerald-50/70">
      <CardHeader className="gap-3 ">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-background/90">
              <CheckCircle2 className="size-4 text-emerald-600" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Imported</Badge>
                <span className="text-xs text-muted-foreground">
                  {formatCreatedEmployeesSummary(createdCount)}{" "}
                  {formatNeedsAccessSummary(needsAccessCount)}
                </span>
              </div>
              <CardTitle className="break-all text-base sm:text-lg">
                {session.sourceFileName}
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <BatchMetaPill label="Source rows" value={sourceRowCount} />
                <BatchMetaPill
                  label="Imported"
                  value={appliedAt ? formatTimestamp(appliedAt) : "Recorded"}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button asChild>
              <Link href="/employees?access=NotInvited&review=access">
                <Users />
                Review access invitations
              </Link>
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href="/employees?access=NotInvited">
                <Eye />
                View employees
              </Link>
            </Button>
            <Button type="button" variant="ghost" onClick={onUpload}>
              <Upload />
              Upload next file
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        <ImportWorkflowSteps steps={getCompletedSteps()} />
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
    <div className="rounded-lg border bg-background/80 px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function ImportHistoryListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-xl border bg-background p-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-64" />
            </div>
            <Skeleton className="h-5 w-14 shrink-0 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ImportHistoryDetailSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-3 w-48" />
      <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-14 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function formatCreatedEmployeesSummary(count: number): string {
  return `${count} employee${count === 1 ? " was" : "s were"} created.`;
}

function formatNeedsAccessSummary(count: number): string {
  return `${count} employee${count === 1 ? " needs" : "s need"} access.`;
}

function formatReadyForAccessSummary(count: number): string {
  return `${count} imported employee${count === 1 ? " is" : "s are"} ready for access.`;
}

function getEventBadgeVariant(
  eventType: ImportHistoryEventType,
  hasErrors: boolean
): "secondary" | "outline" | "destructive" {
  if (eventType === "Validation" && hasErrors) {
    return "destructive";
  }
  return eventType === "Import" ? "secondary" : "outline";
}

function getEventActionLabel(eventType: ImportHistoryEventType): string {
  switch (eventType) {
    case "Upload":
      return "Uploaded";
    case "Validation":
      return "Validated";
    case "Import":
      return "Imported";
  }
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
              File uploads, validations, and imports.
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
            <div className="grid gap-1.5">
              {historyPage.items.map((item, index) => {
                const isSelected = selectedHistoryId === item.id;
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
                      className={`w-full cursor-pointer p-2 text-left transition-colors ${
                        isSelected
                          ? "bg-muted/20"
                          : "hover:border-foreground/15 hover:bg-muted/20"
                      }`}
                      onClick={() => onSelectHistory(item.id)}
                      aria-pressed={isSelected}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {item.sourceFileName}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {getEventActionLabel(item.eventType)}{" "}
                            {formatTimestamp(item.appliedAt)}
                            {" · "}
                            {item.eventType === "Import"
                              ? `${item.createdCount} created · `
                              : ""}
                            {item.eventType === "Validation" &&
                            item.errorCount != null &&
                            item.errorCount > 0
                              ? `${item.errorCount} error${item.errorCount === 1 ? "" : "s"} · `
                              : ""}
                            {item.eventType === "Validation" &&
                            item.warningCount != null &&
                            item.warningCount > 0
                              ? `${item.warningCount} warning${item.warningCount === 1 ? "" : "s"} · `
                              : ""}
                            {item.eventType === "Validation" &&
                            (item.errorCount ?? 0) === 0
                              ? `${item.validRowCount} valid · `
                              : ""}
                            {item.sourceRowCount} rows · by {item.actorFullName}
                          </p>
                        </div>
                        <Badge
                          variant={
                            isSelected
                              ? "secondary"
                              : getEventBadgeVariant(
                                  item.eventType,
                                  (item.errorCount ?? 0) > 0
                                )
                          }
                          className="shrink-0"
                        >
                          {item.status}
                        </Badge>
                      </div>
                    </button>

                    {isSelected ? (
                      <div className="border-t bg-background/70 px-3 py-3">
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
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                              <span>
                                {getEventActionLabel(selectedDetail.eventType)}{" "}
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

                            <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
                              {selectedDetail.eventType === "Import" ? (
                                <HistoryMetric
                                  label="Created"
                                  value={selectedDetail.createdCount}
                                />
                              ) : selectedDetail.eventType === "Validation" &&
                                selectedDetail.errorCount != null ? (
                                <HistoryMetric
                                  label="Errors"
                                  value={selectedDetail.errorCount}
                                />
                              ) : null}
                              {selectedDetail.eventType === "Validation" &&
                              selectedDetail.warningCount != null ? (
                                <HistoryMetric
                                  label="Warnings"
                                  value={selectedDetail.warningCount}
                                />
                              ) : null}
                              <HistoryMetric
                                label="Rows"
                                value={selectedDetail.sourceRowCount}
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

                            {selectedDetail.eventType === "Import" &&
                            selectedDetail.skippedCount > 0 ? (
                              <p className="text-xs text-muted-foreground">
                                {selectedDetail.skippedCount} row
                                {selectedDetail.skippedCount === 1
                                  ? " was"
                                  : "s were"}{" "}
                                skipped due to duplicate emails.
                              </p>
                            ) : null}

                            {selectedDetail.eventType === "Import" &&
                            selectedDetail.failureReason ? (
                              <Alert variant="destructive">
                                <AlertTitle>Failure reason</AlertTitle>
                                <AlertDescription>
                                  {selectedDetail.failureReason}
                                </AlertDescription>
                              </Alert>
                            ) : null}

                            {selectedDetail.eventType === "Import" &&
                            selectedDetail.unresolvedFollowUpIssues.length >
                              0 ? (
                              <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
                                <div>
                                  <p className="text-sm font-medium">
                                    Unresolved follow-up items
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Review imported employees that still need
                                    attention and open the existing fix flow.
                                  </p>
                                </div>

                                <div className="space-y-1.5">
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
                                          className="flex flex-col gap-2 rounded-lg border bg-background p-2 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                          <div>
                                            <p className="text-sm font-medium text-foreground">
                                              {issue.label}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                              Row {issue.sourceRowNumber} •{" "}
                                              {issue.employeeFullName} (
                                              {issue.employeeEmail})
                                            </p>
                                          </div>

                                          {fixHref ? (
                                            <Button
                                              asChild
                                              size="sm"
                                              variant="outline"
                                            >
                                              <Link href={fixHref}>
                                                Open fix
                                              </Link>
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
          <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            No import activity yet.
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
              <h2 className="text-lg font-semibold">Start employee import</h2>
              <p className="text-sm text-muted-foreground">
                Upload a CSV to create a preview and validate it.
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
          Select a problem to filter the preview.
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
    return null;
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
  activeSchema,
  isSchemaLoading,
}: {
  activeSchema?: EmployeeImportSessionDto["employeeImportSchema"];
  isSchemaLoading: boolean;
}) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>Reference details</CardTitle>
        <CardDescription>
          Template field reference for the import file.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isSchemaLoading && !activeSchema ? (
          <div className="space-y-3 rounded-lg border bg-muted/10 p-4">
            <Skeleton className="h-4 w-48" />
            <div className="grid gap-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-muted/10">
            <div className="overflow-x-auto">
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
