"use client";

import { useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
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
  EmployeeImportPreviewRowDto,
  EmployeeImportSessionDto,
  EmployeeImportStage,
} from "./employee-import.types";
import {
  useDownloadEmployeeImportTemplate,
  useEmployeeImportSchema,
  useEmployeeImportSession,
  useUploadEmployeeImport,
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

const IMPORT_STEPS = [
  {
    title: "Download template",
    description: "Get the official employee import CSV.",
  },
  {
    title: "Upload file",
    description: "Create a saved import session from your file.",
  },
  {
    title: "Review preview",
    description: "Review the saved preview before moving to validation.",
  },
] as const;

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

function getStageBadgeVariant(stage: EmployeeImportStage) {
  return stage === "Expired" ? "destructive" : "secondary";
}

function getStageLabel(stage: EmployeeImportStage) {
  return stage === "Expired" ? "Expired" : "Preview ready";
}

function SessionSummary({ session }: { session: EmployeeImportSessionDto }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Latest upload</CardTitle>
        <CardDescription>
          This saved session keeps the uploaded file and preview together so
          you can return and continue the import workflow.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border bg-muted/20 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            File
          </p>
          <p className="mt-1 font-medium">{session.sourceFileName}</p>
          <p className="text-xs text-muted-foreground">
            {formatBytes(session.sourceFileSizeBytes)}
          </p>
        </div>
        <div className="rounded-lg border bg-muted/20 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Rows
          </p>
          <p className="mt-1 font-medium">{session.sourceRowCount}</p>
          <p className="text-xs text-muted-foreground">
            Previewing the first rows only
          </p>
        </div>
        <div className="rounded-lg border bg-muted/20 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Status
          </p>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={getStageBadgeVariant(session.stage)}>
              {getStageLabel(session.stage)}
            </Badge>
          </div>
        </div>
        <div className="rounded-lg border bg-muted/20 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Expires
          </p>
          <p className="mt-1 font-medium">
            {formatTimestamp(session.expiresAt)}
          </p>
        </div>
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
  } = useEmployeeImportSession(sessionId);
  const uploadImport = useUploadEmployeeImport();
  const downloadTemplate = useDownloadEmployeeImportTemplate();

  const activeSchema = session?.employeeImportSchema ?? schema;
  const canonicalFieldKeys =
    activeSchema?.canonicalFields.map((field) => field.key) ?? [];
  const activeHeaders =
    (session?.sourceHeaders ?? canonicalFieldKeys).filter((header) =>
      canonicalFieldKeys.includes(header)
    );
  const sessionAlert = useMemo(() => {
    if (!session) {
      return null;
    }

    if (session.stage === "Expired") {
      return {
        title: "Upload expired",
        description: "Preview expired. Upload the file again to keep going.",
      };
    }

    return {
      title: "Preview ready",
      description:
        "Preview saved. Next step: validate organization and manager references before import.",
    };
  }, [session]);

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
    <div className="flex flex-col gap-6 p-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFileSelected}
      />

      <PageHeader
        title="Import employees"
        description="Use the official CSV template to add or update employees in bulk."
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

      <Card>
        <CardHeader>
          <CardTitle>Download the template and upload your file</CardTitle>
          <CardDescription>
            Use the official CSV to run repeatable employee imports from the
            Employees workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-3 md:grid-cols-3">
            {IMPORT_STEPS.map((step, index) => (
              <div
                key={step.title}
                className="rounded-lg border bg-muted/20 p-4"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Step {index + 1}
                </p>
                <p className="mt-2 font-medium">{step.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border bg-muted/15 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg border bg-background p-2">
                <FileSpreadsheet className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Official template only</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Keep the downloaded header order exactly as-is. Your uploaded
                  rows and preview appear below.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row lg:flex-col">
              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadTemplate}
                disabled={downloadTemplate.isLoading}
                className="lg:w-full"
              >
                {downloadTemplate.isLoading ? <Spinner /> : <Download />}
                Download template
              </Button>
              <Button
                type="button"
                onClick={handleBrowse}
                disabled={uploadImport.isLoading}
                className="lg:w-full"
              >
                {uploadImport.isLoading ? <Spinner /> : <Upload />}
                Upload CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {sessionAlert && (
        <Alert
          variant={session?.stage === "Expired" ? "destructive" : "default"}
        >
          <Eye className="size-4" />
          <AlertTitle>{sessionAlert.title}</AlertTitle>
          <AlertDescription>{sessionAlert.description}</AlertDescription>
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

      {session ? <SessionSummary session={session} /> : null}

      {session ? (
        <Card>
          <CardHeader>
            <CardTitle>Uploaded rows</CardTitle>
            <CardDescription>
              These are the first uploaded rows exactly as the file was read,
              after empty values were trimmed.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      ) : null}

      {session ? (
        <Card>
          <CardHeader>
            <CardTitle>Preview after normalization</CardTitle>
            <CardDescription>
              Review the preview before validating organization and manager
              references in the next import step.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  {PREVIEW_COLUMNS.map((column) => (
                    <TableHead key={column.key}>{column.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {session.previewRows.map((row) => (
                  <TableRow key={row.rowNumber}>
                    <TableCell>{row.rowNumber}</TableCell>
                    {PREVIEW_COLUMNS.map((column) => (
                      <TableCell key={`${row.rowNumber}-${column.key}`}>
                        {row[column.key] ?? (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="justify-between gap-4 text-xs text-muted-foreground">
            <span>
              Showing {session.previewRows.length} of {session.sourceRowCount}{" "}
              row(s)
            </span>
            {session.hasMorePreviewRows ? (
              <span>Additional rows stay persisted in the upload session.</span>
            ) : (
              <span>All uploaded rows are visible in this preview window.</span>
            )}
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="rounded-full border bg-muted/20 p-3">
              <Upload className="size-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">No file uploaded yet</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Download the template, upload your file, and review the preview
                here.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Template field reference</CardTitle>
          <CardDescription>
            The downloaded template is the source of truth. Expand this only if
            you want to review individual field definitions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSchemaLoading && !activeSchema ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner />
              Loading employee import schema...
            </div>
          ) : (
            <details className="rounded-lg border bg-muted/10">
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">
                Review template fields ({activeSchema?.canonicalFields.length ?? 0})
              </summary>
              <div className="border-t">
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
    </div>
  );
}
