"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertTitle,
  Badge,
  Button,
  Input,
  Label,
  Progress,
  Separator,
  cn,
} from "@repo/ds";
import {
  PageContainer,
  PageHeader,
  PagePermissionNotice,
  PageSkeleton,
} from "@repo/ds/shell";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  History,
  RotateCcw,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  translateOrganizationImportError,
  type OrganizationImportIntakeResult,
  type OrganizationImportSessionDto,
} from "@repo/api";
import {
  canManageCoreOrganization,
  canViewCoreOrganization,
  useAuth,
} from "@repo/auth";
import { toast } from "sonner";
import { todayCalendarDate } from "@/features/organization/model/workspace-state";
import {
  useActiveOrganizationImports,
  useOrganizationImportApi,
  useOrganizationImportMutations,
  useOrganizationImportSession,
} from "../api/use-organization-import";

type SourceState =
  | { kind: "idle" }
  | { kind: "uploading"; file: File; token: string }
  | { kind: "inspecting"; file: File; token: string }
  | { kind: "sheet-choice"; file: File; token: string; sheets: string[] }
  | {
      kind: "rejected" | "temporary";
      file: File;
      token: string;
      message: string;
    };

const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

export default function OrganizationImportWorkspace({
  sessionId,
}: {
  sessionId?: string;
}) {
  const { user, isLoading } = useAuth();
  const canView = canViewCoreOrganization(user);
  const canManage = canManageCoreOrganization(user);

  if (isLoading)
    return <PageSkeleton rows={5} label="Loading Organization import" />;
  if (!canView)
    return (
      <PageContainer className="space-y-6">
        <PageHeader title="Import organization structure" />
        <PagePermissionNotice
          title="Organization access required"
          description="You do not have permission to view this tenant’s Organization."
        />
      </PageContainer>
    );
  if (!canManage)
    return (
      <PageContainer className="space-y-6">
        <PageHeader title="Import organization structure" />
        <PagePermissionNotice
          title="Organization management access required"
          description="You can view Organization, but importing its structure requires management access."
          action={
            <Button asChild variant="outline">
              <Link href="/organization">Back to Organization</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  return sessionId ? (
    <DurableImportWorkspace sessionId={sessionId} />
  ) : (
    <NewImportWorkspace />
  );
}

function TaskHeader({ description }: { description: string }) {
  return (
    <div className="space-y-4">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit text-muted-foreground"
      >
        <Link href="/organization">
          <ArrowLeft className="h-4 w-4" />
          Organization
        </Link>
      </Button>
      <PageHeader
        title="Import organization structure"
        description={description}
      />
    </div>
  );
}

function NewImportWorkspace() {
  const router = useRouter();
  const api = useOrganizationImportApi();
  const mutations = useOrganizationImportMutations();
  const active = useActiveOrganizationImports();
  const inputRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const [effectiveDate, setEffectiveDate] = useState(() => todayCalendarDate());
  const intendedDateRef = useRef(effectiveDate);
  const [source, setSource] = useState<SourceState>({ kind: "idle" });
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (
      source.kind === "sheet-choice" ||
      source.kind === "rejected" ||
      source.kind === "temporary"
    )
      statusRef.current?.focus();
  }, [source.kind]);

  async function inspect(
    file: File,
    token: string,
    selectedSheetName?: string
  ) {
    setSource({ kind: "uploading", file, token });
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve())
    );
    setSource({ kind: "inspecting", file, token });
    try {
      const result = await mutations.intake.mutateAsync({
        file,
        creationToken: token,
        effectiveDate,
        selectedSheetName,
      });
      if (result.kind === "SheetSelectionRequired") {
        setSource({
          kind: "sheet-choice",
          file,
          token,
          sheets: result.sheetSelection.candidateSheetNames,
        });
        return;
      }
      await finishDurable(result);
    } catch (error) {
      const problem = translateOrganizationImportError(error);
      setSource({
        kind:
          problem.kind === "rejected" || problem.kind === "conflict"
            ? "rejected"
            : "temporary",
        file,
        token,
        message: problem.message,
      });
    }
  }

  async function finishDurable(
    result: Extract<OrganizationImportIntakeResult, { kind: "SourceReady" }>
  ) {
    let session = result.session;
    const intendedDate = intendedDateRef.current;
    if (session.effectiveDate !== intendedDate) {
      session = await mutations.changeDate.mutateAsync({
        id: session.id,
        version: session.version,
        effectiveDate: intendedDate,
      });
    }
    router.replace(`/organization/import/${session.id}`);
  }

  function choose(file: File | undefined) {
    if (!file) return;
    const token = crypto.randomUUID();
    if (file.size > MAX_SOURCE_BYTES) {
      setSource({
        kind: "rejected",
        file,
        token,
        message: "Choose a file no larger than 10 MB.",
      });
      return;
    }
    void inspect(file, token);
  }

  function onInput(event: ChangeEvent<HTMLInputElement>) {
    choose(event.target.files?.[0]);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    choose(event.dataTransfer.files?.[0]);
  }

  async function download(kind: "template" | "export") {
    try {
      const blob =
        kind === "template"
          ? await api.downloadTemplate()
          : await api.exportStructure(effectiveDate);
      downloadBlob(
        blob,
        kind === "template"
          ? "Fusion-organization-template.xlsx"
          : `Fusion-organization-${effectiveDate}.xlsx`
      );
    } catch (error) {
      toast.error(
        kind === "template"
          ? "Template could not be downloaded"
          : "Structure could not be exported",
        {
          description: translateOrganizationImportError(error).message,
        }
      );
    }
  }

  const selected = source.kind === "idle" ? null : source;
  return (
    <PageContainer width="wide" className="space-y-8 pb-14">
      <TaskHeader description="Bring a source into Fusion without changing Organization yet." />

      {active.data?.length ? (
        <section
          aria-labelledby="active-imports-title"
          className="border-y py-4"
        >
          <div className="mb-3 flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h2 id="active-imports-title" className="text-sm font-semibold">
              Active imports
            </h2>
            <Badge variant="secondary">{active.data.length}</Badge>
          </div>
          <div className="divide-y">
            {active.data.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 py-3 max-sm:items-start"
              >
                <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {item.originalFileName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Effective {item.effectiveDate} ·{" "}
                    {item.rowCount.toLocaleString()} rows · Updated by{" "}
                    {item.lastUpdatedByDisplayName}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/organization/import/${item.id}`}>Resume</Link>
                </Button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section
        aria-labelledby="effective-date-title"
        className="grid gap-2 border-b pb-6 sm:grid-cols-[220px_1fr] sm:items-end"
      >
        <div>
          <Label id="effective-date-title" htmlFor="organization-import-date">
            Effective date
          </Label>
          <Input
            id="organization-import-date"
            type="date"
            value={effectiveDate}
            onChange={(event) => {
              const value = event.target.value;
              if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
              intendedDateRef.current = value;
              setEffectiveDate(value);
            }}
            className="mt-2"
          />
        </div>
        <p className="pb-2 text-sm text-muted-foreground">
          This date applies to the whole import and controls the
          current-structure export.
        </p>
      </section>

      <section aria-labelledby="source-title" className="space-y-4">
        <div>
          <h2 id="source-title" className="text-lg font-semibold">
            Source file
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            CSV or XLSX, up to 10 MB.
          </p>
        </div>
        {!selected ? (
          <div
            role="region"
            aria-label="Organization source drop area"
            onDragEnter={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            className={cn(
              "grid min-h-64 place-items-center rounded-2xl border-2 border-dashed bg-muted/15 px-6 text-center transition-colors",
              dragActive && "border-primary bg-primary/[0.04]"
            )}
          >
            <div className="max-w-sm">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <UploadCloud className="h-6 w-6" />
              </div>
              <p className="mt-4 font-semibold">
                Drop your organization source here
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                or choose a file from this device
              </p>
              <Button
                className="mt-5"
                onClick={() => inputRef.current?.click()}
              >
                Choose file
              </Button>
            </div>
          </div>
        ) : (
          <SourceObject
            source={selected}
            statusRef={statusRef}
            onRetry={() => void inspect(selected.file, selected.token)}
            onSheet={(sheet) =>
              void inspect(selected.file, selected.token, sheet)
            }
            onReplace={() => inputRef.current?.click()}
            onRemove={() => setSource({ kind: "idle" })}
          />
        )}
        <input
          ref={inputRef}
          aria-label="Choose an organization source file"
          className="sr-only"
          type="file"
          accept=".csv,.xlsx"
          onChange={onInput}
        />
      </section>

      <section
        aria-label="Import utilities"
        className="flex flex-wrap items-center gap-3 border-t pt-5"
      >
        <Button variant="outline" onClick={() => void download("template")}>
          <Download className="h-4 w-4" />
          Download Fusion template
        </Button>
        <Button variant="ghost" onClick={() => void download("export")}>
          <Download className="h-4 w-4" />
          Export current structure
        </Button>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground max-sm:w-full">
          <CheckCircle2 className="h-3.5 w-3.5" />
          No Organization changes are made during source intake.
        </span>
      </section>
    </PageContainer>
  );
}

function SourceObject({
  source,
  statusRef,
  onRetry,
  onSheet,
  onReplace,
  onRemove,
}: {
  source: Exclude<SourceState, { kind: "idle" }>;
  statusRef: React.RefObject<HTMLDivElement | null>;
  onRetry: () => void;
  onSheet: (sheet: string) => void;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const busy = source.kind === "uploading" || source.kind === "inspecting";
  return (
    <div className="rounded-2xl border bg-background p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <FileSpreadsheet className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{source.file.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatBytes(source.file.size)}
          </p>
        </div>
        {!busy ? (
          <Button variant="ghost" size="sm" onClick={onReplace}>
            Replace
          </Button>
        ) : null}
        {!busy ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Remove selected file"
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      {busy ? (
        <div className="mt-5" role="status" aria-live="polite">
          <div className="mb-2 flex justify-between text-sm">
            <span>
              {source.kind === "uploading"
                ? "Uploading source"
                : "Inspecting workbook structure"}
            </span>
            <span className="text-muted-foreground">Please wait</span>
          </div>
          <Progress value={source.kind === "uploading" ? 38 : 72} />
        </div>
      ) : source.kind === "sheet-choice" ? (
        <div
          ref={statusRef}
          tabIndex={-1}
          className="mt-5 border-t pt-4 outline-none"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm font-semibold">
            Choose the worksheet that contains the structure
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {source.sheets.map((sheet) => (
              <Button
                key={sheet}
                variant="outline"
                onClick={() => onSheet(sheet)}
              >
                {sheet}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <Alert
          ref={statusRef}
          tabIndex={-1}
          variant={source.kind === "rejected" ? "destructive" : "default"}
          className="mt-5 outline-none"
          role="alert"
        >
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {source.kind === "rejected"
              ? "This source could not be accepted"
              : "Inspection was interrupted"}
          </AlertTitle>
          <AlertDescription className="mt-1">
            {source.message}
            <Button
              variant="outline"
              size="sm"
              className="mt-3 block"
              onClick={onRetry}
            >
              <RotateCcw className="h-4 w-4" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function DurableImportWorkspace({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const sessionQuery = useOrganizationImportSession(sessionId);
  const mutations = useOrganizationImportMutations();
  const [date, setDate] = useState("");
  const [discardOpen, setDiscardOpen] = useState(false);
  useEffect(() => {
    if (sessionQuery.data) setDate(sessionQuery.data.effectiveDate);
  }, [sessionQuery.data]);

  if (sessionQuery.isLoading)
    return (
      <PageContainer width="wide">
        <TaskHeader description="Loading the accepted source." />
        <PageSkeleton rows={4} label="Loading accepted source" />
      </PageContainer>
    );
  if (sessionQuery.error)
    return (
      <PageContainer className="space-y-6">
        <TaskHeader description="The accepted source could not be loaded." />
        <PagePermissionNotice
          title="Import not available"
          description={
            translateOrganizationImportError(sessionQuery.error).message
          }
          action={
            <Button onClick={() => void sessionQuery.refetch()}>Retry</Button>
          }
        />
      </PageContainer>
    );
  const session = sessionQuery.data;
  if (!session) return null;
  if (session.status === "Discarded")
    return <DiscardedImport session={session} />;
  const activeSession = session;

  async function changeDate(value: string) {
    setDate(value);
    // Native date controls briefly emit an empty value while a user replaces
    // the current date. Keep that intermediate editing state local instead of
    // sending an invalid mutation and racing the completed value.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    try {
      await mutations.changeDate.mutateAsync({
        id: activeSession.id,
        version: activeSession.version,
        effectiveDate: value,
      });
      await sessionQuery.refetch();
    } catch (error) {
      toast.error("Effective date was not changed", {
        description: translateOrganizationImportError(error).message,
      });
      setDate(activeSession.effectiveDate);
    }
  }

  async function discard() {
    try {
      await mutations.discard.mutateAsync({
        id: activeSession.id,
        version: activeSession.version,
      });
      router.replace("/organization/import");
    } catch (error) {
      toast.error("Import was not discarded", {
        description: translateOrganizationImportError(error).message,
      });
    }
  }

  return (
    <PageContainer width="wide" className="space-y-8 pb-14">
      <TaskHeader description="This source is saved and ready for the next import phase." />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section aria-labelledby="accepted-source-title" className="min-w-0">
          <div className="flex items-start gap-4 border-b pb-6">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-success-subtle text-success">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="accepted-source-title"
                  className="truncate text-lg font-semibold"
                >
                  {session.source.originalFileName}
                </h2>
                <Badge>Accepted source</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {session.source.sourceFormat.toUpperCase()} ·{" "}
                {formatBytes(session.source.byteLength)} ·{" "}
                {session.source.rowCount.toLocaleString()} data rows ·{" "}
                {session.source.columnCount} columns
              </p>
            </div>
          </div>
          <dl className="grid gap-x-8 gap-y-5 py-6 sm:grid-cols-2">
            <Metadata
              label="Worksheet"
              value={session.source.selectedSheetName}
            />
            <Metadata
              label="Source range"
              value={session.source.selectedRange}
            />
            <Metadata label="Started by" value={session.startedByDisplayName} />
            <Metadata
              label="Last updated by"
              value={session.lastUpdatedByDisplayName}
            />
          </dl>
          {session.source.table?.columns.length ? (
            <div className="border-t pt-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Source labels
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {session.source.table.columns.map((column) => (
                  <Badge key={column.index} variant="secondary">
                    {column.sourceLabel || `Column ${column.index + 1}`}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </section>
        <aside className="space-y-6 border-l pl-8 max-lg:border-l-0 max-lg:border-t max-lg:pl-0 max-lg:pt-6">
          <div>
            <Label htmlFor="durable-effective-date">Effective date</Label>
            <div className="relative mt-2">
              <CalendarDays className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="durable-effective-date"
                type="date"
                className="pl-9"
                value={date}
                disabled={mutations.changeDate.isLoading}
                onChange={(event) => void changeDate(event.target.value)}
              />
            </div>
          </div>
          <Separator />
          <div className="space-y-2 text-sm">
            <p className="font-medium">Canonical context</p>
            <p className="text-muted-foreground">
              {session.baseline.hasPermanentRootIdentity
                ? "A permanent Organization root exists."
                : "No permanent Organization root exists yet."}
            </p>
            <p className="text-muted-foreground">
              {session.baseline.hasRootAsOfEffectiveDate
                ? "A structure exists on this effective date."
                : "No structure exists on this effective date."}
            </p>
          </div>
          <Button
            variant="outline"
            className="w-full text-destructive hover:text-destructive"
            onClick={() => setDiscardOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Discard import
          </Button>
        </aside>
      </div>
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this import?</AlertDialogTitle>
            <AlertDialogDescription>
              The accepted source and its parsed cells will be removed. Source
              metadata remains for audit context, and this import cannot be
              resumed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep import</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={mutations.discard.isLoading}
              onClick={() => void discard()}
            >
              Discard import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

function DiscardedImport({
  session,
}: {
  session: OrganizationImportSessionDto;
}) {
  return (
    <PageContainer className="space-y-8">
      <TaskHeader description="This import is no longer active." />
      <PagePermissionNotice
        title="Import discarded"
        description={`${session.source.originalFileName} can no longer be resumed. Its source payload has been removed.`}
        action={
          <Button asChild>
            <Link href="/organization/import">Start another import</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
