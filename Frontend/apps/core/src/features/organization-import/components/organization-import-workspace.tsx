"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from "react";
import { Button, Input, Label, Spinner, cn } from "@repo/ds";
import {
  PageContainer,
  PageHeader,
  PagePermissionNotice,
  PageSkeleton,
} from "@repo/ds/shell";
import {
  ArrowLeft,
  CheckCircle2,
  FileDown,
  FileOutput,
  FileSpreadsheet,
  RotateCcw,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  translateOrganizationImportError,
  type OrganizationImportActiveSummaryDto,
  type OrganizationImportIntakeResult,
} from "@repo/api";
import {
  canManageCoreOrganization,
  canViewCoreOrganization,
  useAuth,
} from "@repo/auth";
import { toast } from "sonner";
import { todayCalendarDate } from "@/features/organization/model/workspace-state";
import { useOrganizationReadiness } from "@/features/organization/api/use-organization";
import { downloadBlob, formatHumanDate, formatRelativeTime } from "../model/format";
import {
  useActiveOrganizationImports,
  useOrganizationImportApi,
  useOrganizationImportMutations,
} from "../api/use-organization-import";
import { ImportReviewWorkspace } from "./import-review-workspace";

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
        <PageHeader title="Import structure" />
        <PagePermissionNotice
          title="Organization access required"
          description="You do not have permission to view this tenant’s Organization."
        />
      </PageContainer>
    );
  if (!canManage)
    return (
      <PageContainer className="space-y-6">
        <PageHeader title="Import structure" />
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
    <ImportReviewWorkspace sessionId={sessionId} />
  ) : (
    <NewImportWorkspace />
  );
}

function TaskHeader({
  description,
  actions,
}: {
  description: string;
  actions?: ReactNode;
}) {
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
          Back to Structure
        </Link>
      </Button>
      <PageHeader
        title="Import structure"
        description={description}
        actions={actions}
      />
    </div>
  );
}

function EffectiveDateControl({
  id,
  value,
  today,
  disabled,
  align = "left",
  onChange,
}: {
  id: string;
  value: string;
  today: string;
  disabled?: boolean;
  align?: "left" | "right";
  onChange: (value: string) => void;
}) {
  const meaning =
    value === today ? "Today" : value > today ? "Scheduled" : "Past-dated";
  const right = align === "right";
  return (
    <div className={right ? "sm:text-right" : undefined}>
      <Label htmlFor={id}>Effective date</Label>
      <div
        className={cn(
          "mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5",
          right && "sm:justify-end"
        )}
      >
        <Input
          id={id}
          type="date"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="w-[190px]"
        />
        <span className="text-sm text-muted-foreground">
          {meaning}
          {value && !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
            ? ` · ${formatHumanDate(value)}`
            : ""}
        </span>
      </div>
    </div>
  );
}

function NewImportWorkspace() {
  const router = useRouter();
  const api = useOrganizationImportApi();
  const mutations = useOrganizationImportMutations();
  const active = useActiveOrganizationImports();
  const readiness = useOrganizationReadiness();
  const inputRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const today = todayCalendarDate();
  const [effectiveDate, setEffectiveDate] = useState(today);
  const intendedDateRef = useRef(effectiveDate);
  const [source, setSource] = useState<SourceState>({ kind: "idle" });
  const [dragActive, setDragActive] = useState(false);
  // While a source is in hand, hold the in-progress list at its pre-upload
  // state so the session we are about to create never flashes into it before
  // the route hands off.
  const [frozenActive, setFrozenActive] = useState<
    OrganizationImportActiveSummaryDto[] | null
  >(null);
  const hasCanonicalStructure = readiness.data?.hasPermanentRoot === true;
  const activeList = source.kind === "idle" ? active.data : frozenActive;

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
    setFrozenActive(active.data ?? []);
    const token = crypto.randomUUID();
    if (file.size > MAX_SOURCE_BYTES) {
      setSource({
        kind: "rejected",
        file,
        token,
        message: "This file is larger than the 10 MB upload limit.",
      });
      return;
    }
    void inspect(file, token);
  }

  function onInput(event: ChangeEvent<HTMLInputElement>) {
    choose(event.target.files?.[0]);
    event.target.value = "";
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

  const onDateChange = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      setEffectiveDate(value);
      return;
    }
    intendedDateRef.current = value;
    setEffectiveDate(value);
  };
  return (
    <PageContainer width="wide" className="space-y-8 pb-14">
      <TaskHeader
        description="Bring an existing organization structure into Fusion."
        actions={
          <EffectiveDateControl
            id="organization-import-date"
            value={effectiveDate}
            today={today}
            align="right"
            onChange={onDateChange}
          />
        }
      />

      {activeList?.length ? (
        <section
          aria-labelledby="active-imports-title"
          className="border-y py-4"
        >
          <h2 id="active-imports-title" className="mb-3 text-sm font-semibold">
            {activeList.length === 1
              ? "Import in progress"
              : "Imports in progress"}
          </h2>
          <div className="divide-y">
            {activeList.map((item) => (
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
                    Effective {formatHumanDate(item.effectiveDate)} · updated{" "}
                    {formatRelativeTime(item.updatedAt ?? item.createdAt)} by{" "}
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

      <section aria-labelledby="source-title" className="space-y-4">
        <h2 id="source-title" className="text-lg font-semibold">
          Upload your file
        </h2>
        <UploadSurface
          source={source}
          dragActive={dragActive}
          onDragActiveChange={setDragActive}
          onFile={choose}
          onBrowse={() => inputRef.current?.click()}
          statusRef={statusRef}
          onRetry={() => {
            if (source.kind !== "idle") void inspect(source.file, source.token);
          }}
          onSheet={(sheet) => {
            if (source.kind !== "idle")
              void inspect(source.file, source.token, sheet);
          }}
          onRemove={() => {
            setFrozenActive(null);
            setSource({ kind: "idle" });
          }}
        />
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
        className="space-y-3 border-t pt-5"
      >
        <p className="text-sm font-medium">Need a file to start from?</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => void download("template")}>
            <FileDown className="h-4 w-4" />
            Download Fusion template
          </Button>
          {hasCanonicalStructure ? (
            <Button variant="outline" onClick={() => void download("export")}>
              <FileOutput className="h-4 w-4" />
              Export current structure
            </Button>
          ) : null}
          <p className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            Nothing changes until you review and commit.
          </p>
        </div>
      </section>
    </PageContainer>
  );
}

// One upload surface for every state. The outer drop region keeps a constant
// footprint (min height, centered stack, 2px border) so idle → processing →
// rejected → ready change *inside* it rather than swapping in differently
// shaped cards. Only the icon, primary line, action slot, and the lower
// informational line change; geometry does not.
function UploadSurface({
  source,
  dragActive,
  onDragActiveChange,
  onFile,
  onBrowse,
  statusRef,
  onRetry,
  onSheet,
  onRemove,
}: {
  source: SourceState;
  dragActive: boolean;
  onDragActiveChange: (active: boolean) => void;
  onFile: (file: File | undefined) => void;
  onBrowse: () => void;
  statusRef: React.RefObject<HTMLDivElement | null>;
  onRetry: () => void;
  onSheet: (sheet: string) => void;
  onRemove: () => void;
}) {
  const idle = source.kind === "idle";
  const busy = source.kind === "uploading" || source.kind === "inspecting";
  const sheetChoice = source.kind === "sheet-choice";
  const rejected = source.kind === "rejected";
  const temporary = source.kind === "temporary";
  const fileName = source.kind === "idle" ? null : source.file.name;

  const columnRole =
    busy || sheetChoice
      ? "status"
      : rejected || temporary
        ? "alert"
        : undefined;

  return (
    <div
      role="region"
      aria-label="Organization source drop area"
      onDragEnter={(event: DragEvent<HTMLDivElement>) => {
        if (busy) return;
        event.preventDefault();
        onDragActiveChange(true);
      }}
      onDragOver={(event: DragEvent<HTMLDivElement>) => event.preventDefault()}
      onDragLeave={() => onDragActiveChange(false)}
      onDrop={(event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        onDragActiveChange(false);
        if (!busy) onFile(event.dataTransfer.files?.[0]);
      }}
      className={cn(
        "grid min-h-64 place-items-center rounded-2xl border-2 px-6 py-6 text-center transition-colors",
        idle && "border-dashed border-border bg-muted/15",
        !idle && "bg-background",
        busy && !dragActive && "border-primary/35",
        sheetChoice && !dragActive && "border-primary/35",
        rejected &&
          !dragActive &&
          "border-destructive/40 bg-destructive/[0.03]",
        temporary && !dragActive && "border-warning/45 bg-warning/[0.04]",
        dragActive && "border-dashed border-primary bg-primary/[0.05]"
      )}
    >
      <div
        ref={idle ? undefined : statusRef}
        tabIndex={idle ? undefined : -1}
        role={columnRole}
        aria-live={busy || sheetChoice ? "polite" : undefined}
        className="flex w-full max-w-sm flex-col items-center outline-none"
      >
        <div
          className={cn(
            "grid h-12 w-12 shrink-0 place-items-center rounded-xl transition-colors",
            !rejected && !temporary && "bg-primary/10 text-primary",
            busy && "ring-1 ring-primary/25",
            rejected && "bg-destructive/10 text-destructive",
            temporary && "bg-warning/10 text-warning"
          )}
        >
          {idle ? (
            <UploadCloud className="h-6 w-6" />
          ) : (
            <FileSpreadsheet className="h-6 w-6" />
          )}
        </div>

        <p className="mt-4 w-full truncate px-2 font-semibold">
          {idle
            ? dragActive
              ? "Drop file to upload"
              : "Drop your XLSX or CSV here"
            : fileName}
        </p>

        {idle ? (
          <Button className="mt-5" onClick={onBrowse}>
            Browse files
          </Button>
        ) : busy ? (
          <div className="mt-5 flex h-9 items-center justify-center text-primary">
            <Spinner className="size-5" aria-hidden />
          </div>
        ) : sheetChoice && source.kind === "sheet-choice" ? (
          <div className="mt-4 w-full">
            <p className="text-sm font-medium">
              Which sheet contains the organization structure?
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {source.sheets.map((sheet) => (
                <Button
                  key={sheet}
                  variant="outline"
                  size="sm"
                  onClick={() => onSheet(sheet)}
                >
                  {sheet}
                </Button>
              ))}
            </div>
          </div>
        ) : rejected ? (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Button variant="outline" size="sm" onClick={onBrowse}>
              Choose another file
            </Button>
            <Button variant="ghost" size="sm" onClick={onRemove}>
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          </div>
        ) : (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RotateCcw className="h-4 w-4" />
              Try again
            </Button>
            <Button variant="ghost" size="sm" onClick={onRemove}>
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          </div>
        )}

        <div className="mt-4 min-h-4 max-w-xs text-xs">
          {idle ? (
            <p className="text-muted-foreground">XLSX · CSV · up to 10 MB</p>
          ) : busy ? (
            <p className="text-muted-foreground">Inspecting file…</p>
          ) : rejected && source.kind === "rejected" ? (
            <p className="text-destructive">{source.message}</p>
          ) : temporary && source.kind === "temporary" ? (
            <p className="text-muted-foreground">
              {source.message} Your file hasn’t been rejected.
            </p>
          ) : sheetChoice && source.kind === "sheet-choice" ? (
            <button
              type="button"
              onClick={onBrowse}
              className="text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:underline"
            >
              Choose another file
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
