"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@repo/ds";
import {
  PageContainer,
  PageHeader,
  PagePermissionNotice,
  PageSkeleton,
} from "@repo/ds/shell";
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
import {
  ImportOnramp,
  type OnrampDropState,
} from "@/features/data-import/components/import-onramp";
import { organizationOnrampConfig } from "@/features/data-import/model/import-descriptor";

type SourceState =
  | { kind: "idle" }
  | {
      kind: "processing";
      phase: "uploading" | "interpreting" | "ready";
      file: File;
      token: string;
    }
  | { kind: "sheet-choice"; file: File; token: string; sheets: string[] }
  | {
      kind: "rejected" | "temporary";
      file: File;
      token: string;
      message: string;
    };

const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
// Deliberate hold durations, exported as a mutable object so tests can neutralise the beats and assert
// the hand-off without waiting on real time. In the product these give the phases their perceptible
// rhythm: the interpret beat is held so the "Fusion is working the file" phase is always seen even when
// intake resolves instantly, and a short "ready" settle makes the hand-off read as a resolution.
export const importIntakeTiming = { minInterpretMs: 3400, readyHoldMs: 750 };

const delay = (ms: number) =>
  ms <= 0 ? Promise.resolve() : new Promise<void>((resolve) => setTimeout(resolve, ms));

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

/**
 * Organization import entry — the pre-session on-ramp. Owns the durable intake handoff
 * (choose an effective date, add a source, resolve a sheet, or resume one of the imports in
 * progress) and routes into the session at /organization/import/{id}. Rendering is the
 * shared Import on-ramp; this adapter maps the organization intake flow onto it.
 */
function NewImportWorkspace() {
  const router = useRouter();
  const api = useOrganizationImportApi();
  const mutations = useOrganizationImportMutations();
  const active = useActiveOrganizationImports();
  const readiness = useOrganizationReadiness();
  const today = todayCalendarDate();
  const [effectiveDate, setEffectiveDate] = useState(today);
  const intendedDateRef = useRef(effectiveDate);
  const [source, setSource] = useState<SourceState>({ kind: "idle" });
  // While a source is in hand, hold the in-progress list at its pre-upload state so the
  // session we are about to create never flashes into it before the route hands off.
  const [frozenActive, setFrozenActive] = useState<
    OrganizationImportActiveSummaryDto[] | null
  >(null);
  const hasCanonicalStructure = readiness.data?.hasPermanentRoot === true;
  const activeList = source.kind === "idle" ? active.data : frozenActive;

  async function inspect(file: File, token: string, selectedSheetName?: string) {
    setSource({ kind: "processing", phase: "uploading", file, token });
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
      // The source is durable; move into the interpret beat and hold it so the phase is always seen,
      // then settle on a brief "ready" beat before handing off to the review.
      setSource({ kind: "processing", phase: "interpreting", file, token });
      const interpretStart = Date.now();
      const session = await resolveDurable(result);
      const remaining = importIntakeTiming.minInterpretMs - (Date.now() - interpretStart);
      if (remaining > 0) await delay(remaining);
      setSource({ kind: "processing", phase: "ready", file, token });
      await delay(importIntakeTiming.readyHoldMs);
      router.replace(`/organization/import/${session.id}`);
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

  async function resolveDurable(
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
    return session;
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
        { description: translateOrganizationImportError(error).message }
      );
    }
  }

  const onDateChange = (value: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) intendedDateRef.current = value;
    setEffectiveDate(value);
  };

  const processing =
    source.kind === "processing"
      ? { phase: source.phase, fileName: source.file.name }
      : null;

  const drop: OnrampDropState =
    source.kind === "rejected"
      ? { kind: "rejected", fileName: source.file.name, message: source.message }
      : source.kind === "temporary"
        ? { kind: "temporary", fileName: source.file.name, message: source.message }
        : { kind: "idle" };

  const sheet =
    source.kind === "sheet-choice"
      ? {
          fileName: source.file.name,
          sheets: source.sheets.map((name) => ({ name })),
          onSelect: (name: string) =>
            void inspect(source.file, source.token, name),
        }
      : null;

  return (
    <ImportOnramp
      config={organizationOnrampConfig}
      date={{ value: effectiveDate, today, onChange: onDateChange }}
      resume={
        activeList?.length
          ? activeList.map((item) => ({
              id: item.id,
              fileName: item.originalFileName,
              asOfLabel: formatHumanDate(item.effectiveDate),
              metaLine: `updated ${formatRelativeTime(item.updatedAt ?? item.createdAt)} by ${item.lastUpdatedByDisplayName}`,
              href: `/organization/import/${item.id}`,
              onDiscard: () =>
                void mutations.discard.mutateAsync({ id: item.id, version: item.version }),
            }))
          : null
      }
      drop={drop}
      sheet={sheet}
      processing={processing}
      onFile={(file) => choose(file)}
      onRetry={() => {
        if (source.kind !== "idle") void inspect(source.file, source.token);
      }}
      onRemove={() => {
        setFrozenActive(null);
        setSource({ kind: "idle" });
      }}
      onDownloadTemplate={() => void download("template")}
      onExport={hasCanonicalStructure ? () => void download("export") : null}
    />
  );
}
