"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
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
  Unlock,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  canAccessCoreAccess,
  canManageCoreAccessProfiles,
  useAuth,
} from "@repo/auth";
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
  EmployeeImportApplyOperationDto,
  EmployeeImportApplyResultDto,
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
import { canAccessEmployeeRoster } from "@/lib/employee-roster-access";

const MAX_VISIBLE_SELECTED_ROWS = 12;

type BatchMetaItem = {
  label: string;
  value: string | number;
};

type BatchHealthItem = {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning" | "danger";
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

type WorkflowProgressModel = {
  value: number;
  title: string;
  valueText: string;
  toneClassName: string;
  trackClassName: string;
  indicatorClassName: string;
  pulse: boolean;
};

function getBatchMetaItems(session: EmployeeImportSessionDto): BatchMetaItem[] {
  return [
    { label: "Rows", value: session.sourceRowCount },
    { label: "Size", value: formatBytes(session.sourceFileSizeBytes) },
    { label: "Expires", value: formatTimestamp(session.expiresAt) },
  ];
}

function getImportModeLabel(mode: EmployeeImportSessionDto["importMode"]): string {
  if (mode === "Correction") {
    return "Correction";
  }

  if (mode === "BusinessChange") {
    return "Business change";
  }

  return "Not set";
}

function getBatchHealthItems(session: EmployeeImportSessionDto): BatchHealthItem[] {
  if (session.stage === "Applied") {
    return [
      {
        label: "Ready rows",
        value: session.lastApplyOperation?.processedRowCount ?? session.sourceRowCount,
        tone: "success",
      },
      {
        label: "Issues",
        value: 0,
        tone: "default",
      },
      {
        label: "Warnings",
        value: 0,
        tone: "default",
      },
      {
        label: "Mode",
        value: getImportModeLabel(session.importMode),
        tone: "default",
      },
    ];
  }
  return [
    {
      label: "Ready rows",
      value: session.validationSummary.validRows,
      tone:
        session.validationSummary.validRows > 0
          ? "success"
          : session.validationSummary.errorCount > 0
            ? "danger"
            : "default",
    },
    {
      label: "Issues",
      value: session.validationSummary.errorCount,
      tone: session.validationSummary.errorCount > 0 ? "danger" : "default",
    },
    {
      label: "Warnings",
      value: session.validationSummary.warningCount,
      tone:
        session.validationSummary.warningCount > 0 ? "warning" : "default",
    },
    {
      label: "Mode",
      value: getImportModeLabel(session.importMode),
    },
  ];
}

function getApplyProgressValue(
  applyOperation: EmployeeImportApplyOperationDto | null
): number {
  if (!applyOperation) {
    return 0;
  }

  if (applyOperation.status === "Succeeded") {
    return 100;
  }

  const total = applyOperation.validatedRowCount ?? 0;
  if (total <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, Math.round((applyOperation.processedRowCount / total) * 100))
  );
}

function getApplyProgressSummary(
  applyOperation: EmployeeImportApplyOperationDto | null,
  percent: number
): string {
  if (!applyOperation) {
    return "0%";
  }

  const total = applyOperation.validatedRowCount ?? 0;
  if (applyOperation.status === "Queued") {
    return total > 0 ? `${total} rows ready` : "Waiting";
  }

  if (applyOperation.status === "Running") {
    return total > 0
      ? `${Math.min(applyOperation.processedRowCount, total)} / ${total}`
      : `${percent}%`;
  }

  return `${percent}%`;
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
  if (session.stage === "Applied") {
    return {
      label: "Imported",
      variant: "secondary",
      cardClassName: "border-emerald-200/60 bg-card dark:border-emerald-500/25",
    };
  }
  if (session.stage === "Expired") {
    return {
      label: "Expired",
      variant: "destructive",
      cardClassName: "border-destructive/20 bg-card",
    };
  }
  if (isApplying) {
    return {
      label: "Importing",
      variant: "default",
      cardClassName: "border-primary/20 bg-card",
    };
  }
  if (
    session.stage === "Validated" &&
    session.validationSummary.errorCount > 0
  ) {
    return {
      label: "Blocked",
      variant: "destructive",
      cardClassName: "border-destructive/20 bg-card",
    };
  }
  if (session.stage === "Validated") {
    return {
      label: "Ready to import",
      variant: "secondary",
      cardClassName: "border-emerald-200/60 bg-card dark:border-emerald-500/25",
    };
  }
  if (isValidating) {
    return {
      label: "Validating",
      variant: "outline",
      cardClassName: "border-primary/20 bg-card",
    };
  }
  return {
    label: "Preview ready",
    variant: "outline",
    cardClassName: "border-border/60 bg-card",
  };
}

function getWorkflowHeadline({
  session,
  isValidating,
  isApplying,
  applyOperation,
}: {
  session: EmployeeImportSessionDto;
  isValidating: boolean;
  isApplying: boolean;
  applyOperation: EmployeeImportApplyOperationDto | null;
}) {
  if (session.stage === "Applied") {
    const createdCount =
      applyOperation?.createdCount ?? session.validationSummary.validRows;
    return {
      title: `${createdCount} employee${
        createdCount === 1 ? "" : "s"
      } imported`,
    };
  }

  if (session.stage === "Expired") {
    return {
      title: "Session expired",
    };
  }

  if (applyOperation?.status === "Queued") {
    return {
      title: "Import queued",
    };
  }

  if (applyOperation?.status === "Running" || session.stage === "Applying") {
    return {
      title: "Import in progress",
    };
  }

  if (
    session.stage === "Validated" &&
    session.validationSummary.errorCount > 0
  ) {
    return {
      title: "Resolve issues before import",
    };
  }

  if (session.stage === "Validated") {
    return {
      title: `${session.validationSummary.validRows} employee${
        session.validationSummary.validRows === 1 ? "" : "s"
      } ready to import`,
    };
  }

  if (isValidating) {
    return {
      title: "Validating batch",
    };
  }

  if (isApplying) {
    return {
      title: "Importing employees",
    };
  }

  return {
    title: "Preview ready",
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
  if (session.stage === "Applied") {
    return getCompletedSteps();
  }

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

function getWorkflowProgressModel({
  session,
  isValidating,
  isApplying,
  applyOperation,
}: {
  session: EmployeeImportSessionDto;
  isValidating: boolean;
  isApplying: boolean;
  applyOperation: EmployeeImportApplyOperationDto | null;
}): WorkflowProgressModel {
  if (session.stage === "Applied") {
    return {
      value: 100,
      title: "Import complete",
      valueText: "Done",
      toneClassName: "text-emerald-700 dark:text-emerald-300",
      trackClassName: "bg-emerald-100 dark:bg-emerald-500/15",
      indicatorClassName: "bg-emerald-500 dark:bg-emerald-400",
      pulse: false,
    };
  }

  if (session.stage === "Expired") {
    return {
      value: 18,
      title: "Session expired",
      valueText: "Restart",
      toneClassName: "text-destructive",
      trackClassName: "bg-destructive/10 dark:bg-destructive/15",
      indicatorClassName: "bg-destructive/80",
      pulse: false,
    };
  }

  if (applyOperation?.status === "Queued") {
    const percent = getApplyProgressValue(applyOperation);
    return {
      value: percent,
      title: "Waiting to start",
      valueText: getApplyProgressSummary(applyOperation, percent),
      toneClassName: "text-primary",
      trackClassName: "bg-primary/10 dark:bg-primary/15",
      indicatorClassName: "bg-primary",
      pulse: true,
    };
  }

  if (applyOperation?.status === "Running" || session.stage === "Applying") {
    const percent = getApplyProgressValue(applyOperation);
    // Once every row has been processed the server is committing the batch — surface that as a
    // distinct "Finalizing" step instead of parking the bar at 100% while it looks stalled.
    const isFinalizing =
      applyOperation?.status === "Running" &&
      (applyOperation?.validatedRowCount ?? 0) > 0 &&
      (applyOperation?.processedRowCount ?? 0) >= (applyOperation?.validatedRowCount ?? 0);
    return {
      value: percent,
      title: isFinalizing ? "Finalizing" : "Importing",
      valueText: isFinalizing
        ? "Committing"
        : getApplyProgressSummary(applyOperation, percent),
      toneClassName: "text-primary",
      trackClassName: "bg-primary/10 dark:bg-primary/15",
      indicatorClassName: "bg-primary",
      pulse: true,
    };
  }

  if (
    session.stage === "Validated" &&
    session.validationSummary.errorCount > 0
  ) {
    return {
      value: 67,
      title: "Blocked",
      valueText: "Step 2",
      toneClassName: "text-destructive",
      trackClassName: "bg-destructive/10 dark:bg-destructive/15",
      indicatorClassName: "bg-destructive/80",
      pulse: false,
    };
  }

  if (session.stage === "Validated") {
    return {
      value: 67,
      title: "Ready",
      valueText: "Step 2",
      toneClassName: "text-emerald-700 dark:text-emerald-300",
      trackClassName: "bg-emerald-100 dark:bg-emerald-500/15",
      indicatorClassName: "bg-emerald-500 dark:bg-emerald-400",
      pulse: false,
    };
  }

  if (isValidating) {
    return {
      value: 49,
      title: "Validating",
      valueText: "Step 2",
      toneClassName: "text-primary",
      trackClassName: "bg-primary/10 dark:bg-primary/15",
      indicatorClassName: "bg-primary",
      pulse: true,
    };
  }

  if (isApplying) {
    return {
      value: 92,
      title: "Importing",
      valueText: "Step 3",
      toneClassName: "text-primary",
      trackClassName: "bg-primary/10 dark:bg-primary/15",
      indicatorClassName: "bg-primary",
      pulse: true,
    };
  }

  return {
    value: 33,
    title: "Uploaded",
    valueText: "Step 1",
    toneClassName: "text-foreground",
    trackClassName: "bg-muted/60 dark:bg-muted/40",
    indicatorClassName: "bg-foreground/80 dark:bg-foreground/70",
    pulse: false,
  };
}

function getStepStyle(state: ImportWorkflowStepState) {
  switch (state) {
    case "complete":
      return {
        cell: "border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/10",
        node: "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300",
        status: "text-emerald-700 dark:text-emerald-300",
      };
    case "current":
      return {
        cell: "border-primary/20 bg-primary/5 dark:border-primary/25 dark:bg-primary/10",
        node: "border-primary/25 bg-primary/10 text-primary",
        status: "text-primary",
      };
    case "blocked":
      return {
        cell: "border-destructive/20 bg-destructive/5 dark:border-destructive/25 dark:bg-destructive/10",
        node: "border-destructive/25 bg-destructive/10 text-destructive",
        status: "text-destructive",
      };
    default:
      return {
        cell: "border-border/50 bg-background dark:bg-muted/20",
        node: "border-border/60 bg-muted/50 text-muted-foreground dark:bg-muted/40",
        status: "text-muted-foreground",
      };
  }
}

function BatchMetaPill({ label, value }: BatchMetaItem) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2.5 text-sm dark:bg-muted/30">
      <p className="text-[0.7rem] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium text-foreground">{value}</p>
    </div>
  );
}

function BatchHealthPill({
  label,
  value,
  tone = "default",
}: BatchHealthItem) {
  const toneClassName =
    tone === "success"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "warning"
        ? "text-amber-700 dark:text-amber-300"
        : tone === "danger"
          ? "text-destructive"
          : "text-foreground";

  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums", toneClassName)}>{value}</span>
    </div>
  );
}

function ImportWorkflowSteps({ steps }: { steps: ImportWorkflowStep[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {steps.map((step) => {
        const Icon = step.state === "complete" ? CheckCircle2 : step.icon;
        const style = getStepStyle(step.state);

        return (
          <div
            key={step.key}
            className={cn(
              "relative overflow-hidden rounded-xl border px-3 py-2.5",
              style.cell
            )}
            aria-current={step.state === "current" ? "step" : undefined}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border",
                  style.node
                )}
              >
                {step.isLoading ? (
                  <Spinner className="size-3" />
                ) : (
                  <Icon className="size-3.5" />
                )}
              </div>
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium text-foreground">
                  {step.title}
                </p>
                <p className={cn("text-xs", style.status)}>
                  {step.statusLabel}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WorkflowProgressBar({
  value,
  trackClassName,
  indicatorClassName,
  pulse,
}: Pick<
  WorkflowProgressModel,
  "value" | "trackClassName" | "indicatorClassName" | "pulse"
>) {
  return (
    <div
      role="progressbar"
      aria-label="Employee import workflow progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      className={cn(
        "relative h-2 overflow-hidden rounded-full",
        trackClassName
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out",
          indicatorClassName,
          pulse ? "animate-pulse motion-reduce:animate-none" : undefined
        )}
        style={{ width: `${value}%` }}
      />
      <div className="pointer-events-none absolute inset-0 grid grid-cols-3">
        <div className="border-r border-background/60" />
        <div className="border-r border-background/60" />
        <div />
      </div>
    </div>
  );
}

function ActionCluster({
  session,
  isReadyToImport,
  isExpired,
  hasErrors,
  isValidating,
  isUploading,
  isApplying,
  onValidate,
  onUpload,
  onApply,
  isConfirmOpen,
  setIsConfirmOpen,
  applyError,
}: {
  session: EmployeeImportSessionDto;
  isReadyToImport: boolean;
  isExpired: boolean;
  hasErrors: boolean;
  isValidating: boolean;
  isUploading: boolean;
  isApplying: boolean;
  onValidate: () => void;
  onUpload: () => void;
  onApply: () => Promise<boolean>;
  isConfirmOpen: boolean;
  setIsConfirmOpen: (open: boolean) => void;
  applyError: string | null;
}) {
  const handleConfirm = async () => {
    const didApply = await onApply();
    if (didApply) {
      setIsConfirmOpen(false);
    }
  };

  if (isReadyToImport) {
    return (
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
            size="lg"
            className="w-full justify-center"
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
              {session.validationSummary.validRows === 1 ? "" : "s"} from{" "}
              {session.sourceFileName}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {applyError ? (
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
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isApplying}>Cancel</AlertDialogCancel>
            <Button type="button" disabled={isApplying} onClick={handleConfirm}>
              {isApplying ? <Spinner /> : <ClipboardCheck />}
              {isApplying ? "Importing employees" : "Import employees"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  if (hasErrors || isExpired) {
    return (
      <Button
        type="button"
        size="lg"
        className="w-full justify-center"
        onClick={onUpload}
        disabled={isUploading || isValidating || isApplying}
      >
        {isUploading ? <Spinner /> : <Upload />}
        {hasErrors ? "Upload corrected file" : "Upload file again"}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size="lg"
      className="w-full justify-center"
      onClick={onValidate}
      disabled={!session.canValidate || isUploading || isValidating || isApplying}
    >
      {isValidating ? <Spinner /> : <Eye />}
      {isValidating ? "Validating file" : "Validate file"}
    </Button>
  );
}

function AppliedCtaCluster() {
  const { user } = useAuth();
  const canOpenAccessWorkspace =
    canAccessCoreAccess(user) || canManageCoreAccessProfiles(user);
  const canOpenEmployeeDirectory = canAccessEmployeeRoster(user);

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {canOpenAccessWorkspace ? (
        <Button asChild size="sm" className="w-full justify-center">
          <Link href="/access">
            <Unlock />
            Activate access
          </Link>
        </Button>
      ) : null}
      {canOpenEmployeeDirectory ? (
        <Button asChild type="button" variant="outline" size="sm" className="w-full justify-center">
          <Link href="/employees">
            <Users />
            See employees
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

export function BatchActionPanel({
  session,
  applyOperation,
  applyResult,
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
  applyOperation: EmployeeImportApplyOperationDto | null;
  applyResult: EmployeeImportApplyResultDto | null;
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
  const healthItems = getBatchHealthItems(session);
  const steps = getWorkflowSteps({ session, isValidating, isApplying });
  const headline = getWorkflowHeadline({
    session,
    isValidating,
    isApplying,
    applyOperation,
  });
  const progress = getWorkflowProgressModel({
    session,
    isValidating,
    isApplying,
    applyOperation,
  });
  const isApplied = session.stage === "Applied";
  const statusIcon = isApplied ? (
    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
  ) : isApplying ? (
    <Spinner className="size-4 text-primary" />
  ) : isValidated && !hasErrors ? (
    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
  ) : !isValidated && !isExpired ? (
    <Eye className="size-4 text-muted-foreground" />
  ) : (
    <AlertCircle className="size-4 text-destructive" />
  );

  return (
    <Card className={cn("overflow-hidden shadow-sm pb-1", statusMeta.cardClassName)}>
      <CardHeader className="gap-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.85fr)]">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/50 dark:bg-muted/40">
                {statusIcon}
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {session.sourceFileName}
                  </span>
                </div>
                <CardTitle className="text-balance text-lg sm:text-xl">
                  {headline.title}
                </CardTitle>
              </div>
            </div>

            <div className="rounded-xl border border-border/50 bg-muted/30 p-3.5 sm:p-4 dark:bg-muted/20">
              <div className="flex items-center justify-between gap-3">
                <p className={cn("text-sm font-medium", progress.toneClassName)}>
                  {progress.title}
                </p>
                <p className={cn("text-sm font-semibold tabular-nums", progress.toneClassName)}>
                  {progress.valueText}
                </p>
              </div>

              <div className="mt-3">
                <WorkflowProgressBar
                  value={progress.value}
                  trackClassName={progress.trackClassName}
                  indicatorClassName={progress.indicatorClassName}
                  pulse={progress.pulse}
                />
              </div>

              <div className="mt-3">
                <ImportWorkflowSteps steps={steps} />
              </div>

              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-border/40 pt-3">
                {healthItems.map((item, index) => (
                  <Fragment key={item.label}>
                    {index > 0 && <div className="hidden sm:block text-border/60">·</div>}
                    <BatchHealthPill {...item} />
                  </Fragment>
                ))}
              </div>
            </div>
          </div>

          <aside className="flex flex-col gap-3 self-start rounded-xl border border-border/50 bg-muted/30 p-3.5 sm:p-4 xl:sticky xl:top-4 dark:bg-muted/20">
            <div className="space-y-2.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Batch controls</p>
              {isApplied ? (
                <AppliedCtaCluster />
              ) : (
                <ActionCluster
                  session={session}
                  isReadyToImport={isReadyToImport}
                  isExpired={isExpired}
                  hasErrors={hasErrors}
                  isValidating={isValidating}
                  isUploading={isUploading}
                  isApplying={isApplying}
                  onValidate={onValidate}
                  onUpload={onUpload}
                  onApply={onApply}
                  isConfirmOpen={isConfirmOpen}
                  setIsConfirmOpen={setIsConfirmOpen}
                  applyError={applyError}
                />
              )}

              <div className="grid gap-1.5 sm:grid-cols-2">
                {!isExpired && !hasErrors ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full justify-center"
                    onClick={onUpload}
                    disabled={isActionLocked}
                  >
                    {isUploading ? <Spinner /> : <Upload />}
                    Upload another file
                  </Button>
                ) : null}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center"
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
              </div>
            </div>

            <div className="border-t border-border/40" />

            <div className="space-y-2.5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Batch metadata</p>
              <div className="grid grid-cols-3 gap-1.5">
                {metaItems.map((item) => (
                  <BatchMetaPill key={item.label} {...item} />
                ))}
              </div>
            </div>
          </aside>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
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

// TODO(deletion): AppliedResultPanel is dead code — replaced by BatchActionPanel handling the Applied state inline.
// Remove AppliedResultPanel, formatCreatedEmployeesSummary, and formatNeedsAccessSummary.
export function AppliedResultPanel({
  session,
  applyResult,
  onUpload,
}: {
  session: EmployeeImportSessionDto;
  applyResult: EmployeeImportApplyResultDto | null;
  onUpload: () => void;
}) {
  if (session.stage !== "Applied") {
    return null;
  }

  const { user } = useAuth();

  const createdCount =
    applyResult?.createdCount ?? session.validationSummary.validRows;
  const sourceRowCount = applyResult?.sourceRowCount ?? session.sourceRowCount;
  const appliedAt = applyResult?.appliedAt ?? session.appliedAt;
  const needsAccessCount = createdCount;
  const canOpenAccessWorkspace =
    canAccessCoreAccess(user) || canManageCoreAccessProfiles(user);
  const canOpenEmployeeDirectory = canAccessEmployeeRoster(user);

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
            {canOpenAccessWorkspace ? (
              <Button asChild>
                <Link href="/access">
                  <Unlock />
                  Activate access
                </Link>
              </Button>
            ) : null}
            {canOpenEmployeeDirectory ? (
              <Button asChild type="button" variant="outline">
                <Link href="/employees">
                  <Users />
                  See employees
                </Link>
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={onUpload}>
              <Upload />
              Upload
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

function ImportHistoryListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-xl border bg-background p-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="h-4 w-48 animate-pulse rounded-md bg-muted" />
              <div className="h-3 w-64 animate-pulse rounded-md bg-muted" />
            </div>
            <div className="h-5 w-14 animate-pulse shrink-0 rounded-full bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

// TODO(deletion): These three formatters are dead code — only used by the removed AppliedResultPanel.
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

function getEventIcon(eventType: ImportHistoryEventType) {
  switch (eventType) {
    case "Upload":
      return Upload;
    case "Validation":
      return Eye;
    case "Import":
      return Users;
    default:
      return History;
  }
}

function getHistoryActorLabel(item: {
  actorFullName: string;
  actorRole: string;
}) {
  return item.actorFullName.trim() || item.actorRole;
}

function getHistoryRowSummary(item: {
  eventType: ImportHistoryEventType;
  sourceRowCount: number;
  validatedRowCount: number;
  createdCount: number;
  unchangedRowCount: number;
  publishedRowCount: number;
  errorCount?: number;
  warningCount?: number;
}) {
  switch (item.eventType) {
    case "Upload":
      return `${item.sourceRowCount} rows ready for validation`;
    case "Validation":
      if ((item.errorCount ?? 0) > 0) {
        return `${item.errorCount} error${item.errorCount === 1 ? "" : "s"}${(item.warningCount ?? 0) > 0 ? ` · ${item.warningCount} warning${item.warningCount === 1 ? "" : "s"}` : ""}`;
      }

      return `${item.validatedRowCount} validated · ${item.sourceRowCount} rows`;
    case "Import":
      return `${item.publishedRowCount} published${item.unchangedRowCount > 0 ? ` · ${item.unchangedRowCount} unchanged` : ""} · ${item.sourceRowCount} rows`;
    default:
      return `${item.sourceRowCount} rows`;
  }
}

export function ImportHistoryPanel({
  historyPage,
  isHistoryLoading,
  historyError,
  onPageChange,
}: {
  historyPage?: EmployeeImportHistoryPageDto;
  isHistoryLoading: boolean;
  historyError: unknown;
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
              {historyPage.items.map((item) => {
                const EventIcon = getEventIcon(item.eventType);

                return (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-xl border border-border bg-background p-3 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/20 text-muted-foreground">
                        <EventIcon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.sourceFileName}
                        </p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>{getHistoryRowSummary(item)}</span>
                          <span>{formatTimestamp(item.appliedAt)}</span>
                          <span>{getHistoryActorLabel(item)}</span>
                        </div>
                      </div>
                      <Badge
                        variant={getEventBadgeVariant(
                          item.eventType,
                          (item.errorCount ?? 0) > 0
                        )}
                        className="shrink-0"
                      >
                        {item.status}
                      </Badge>
                    </div>
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
