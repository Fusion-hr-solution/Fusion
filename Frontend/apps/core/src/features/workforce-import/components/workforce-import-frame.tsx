"use client";

import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ds";
import { PageContainer, PageHeader, PagePermissionNotice } from "@repo/ds/shell";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { canImportCoreEmployees, useAuth } from "@repo/auth";
import { translateWorkforceImportError, type WorkforceImportSessionDto } from "@repo/api";
import { ImportHeader } from "@/features/data-import/components/import-header";
import { ImportAttemptSkeleton } from "@/features/data-import/components/import-skeletons";
import type { ImportStep } from "@/features/data-import/components/import-stepper";
import { formatWorkforceDate } from "@/features/people/components/workforce-ui";
import { useBreadcrumbLabel } from "@/shell/breadcrumb-overrides";
import { EmployeesPageSkeleton } from "@/shell/route-skeletons";
import { useWorkforceImportApi, useWorkforceImportSession } from "../api/use-workforce-import";
import {
  deriveWorkforceImportStage,
  deriveWorkforceMatchOutcome,
  workforceImportGuardTarget,
  workforceImportStageHref,
  type WorkforceImportStage,
  type WorkforceMatchOutcome,
} from "../model/import-stage";

const TITLE = "Import workforce";

type WorkforceImportFrameValue = {
  session: WorkforceImportSessionDto;
  stage: WorkforceImportStage;
  matchOutcome: WorkforceMatchOutcome;
  refetch: () => void;
  /** Hold the stage guard while a publication settles, so the committed attempt hands off once. */
  beginPublish: () => void;
  endPublish: (published: boolean) => void;
};

const WorkforceImportFrameContext = createContext<WorkforceImportFrameValue | null>(null);

export function useWorkforceImportFrame(): WorkforceImportFrameValue {
  const value = useContext(WorkforceImportFrameContext);
  if (!value) throw new Error("useWorkforceImportFrame must be used inside WorkforceImportFrame");
  return value;
}

/**
 * The frame every stage of one workforce import attempt renders inside (`/people/import/{id}/…`).
 * It owns the attempt, derives its stage from server state, keeps the URL honest about it, and
 * draws the shell: file, as-of date, journey and discard. The same grammar as Organization Import.
 */
export function WorkforceImportFrame({ sessionId, children }: { sessionId: string; children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <FrameSkeleton />;
  if (!isAuthenticated || !canImportCoreEmployees(user))
    return (
      <PageContainer className="space-y-6">
        <PageHeader title={TITLE} />
        <PagePermissionNotice title="Import not available" description="You don't have access to import the workforce." />
      </PageContainer>
    );
  return <FrameBody sessionId={sessionId}>{children}</FrameBody>;
}

function FrameBody({ sessionId, children }: { sessionId: string; children: React.ReactNode }) {
  const router = useRouter();
  const segment = useSelectedLayoutSegment();
  const sessionQuery = useWorkforceImportSession(sessionId);
  const session = sessionQuery.data ?? null;
  const publishingRef = useRef(false);
  const [handoff, setHandoff] = useState(false);
  useBreadcrumbLabel(sessionId, session?.source.fileName ?? undefined);

  const stage = session ? deriveWorkforceImportStage(session) : null;
  const target = session && stage ? workforceImportGuardTarget(session, stage, segment) : null;

  useEffect(() => {
    if (!target || handoff || publishingRef.current) return;
    router.replace(target);
  }, [target, handoff, router]);

  if (handoff) return <Handoff />;
  if (sessionQuery.isLoading) return <FrameSkeleton />;
  if (sessionQuery.error || !session || !stage)
    return (
      <PageContainer className="space-y-6">
        <PageHeader title={TITLE} />
        <PagePermissionNotice
          title="Import not available"
          description={translateWorkforceImportError(sessionQuery.error).message}
          action={<Button onClick={() => void sessionQuery.refetch()}>Retry</Button>}
        />
      </PageContainer>
    );
  if (target) return <FrameSkeleton />;

  const value: WorkforceImportFrameValue = {
    session,
    stage,
    matchOutcome: deriveWorkforceMatchOutcome(session),
    refetch: () => void sessionQuery.refetch(),
    beginPublish: () => {
      publishingRef.current = true;
    },
    endPublish: (published) => {
      if (published) setHandoff(true);
      else publishingRef.current = false;
    },
  };

  return (
    <WorkforceImportFrameContext.Provider value={value}>
      <div>
        <PageContainer>
          <ImportHeader
            title={TITLE}
            context={
              <span>
                <span className="font-medium text-foreground">{session.source.fileName ?? "Workforce file"}</span>
                <span className="text-muted-foreground/60" aria-hidden> · </span>
                Workforce as of {formatWorkforceDate(session.baselineDate)}
              </span>
            }
            steps={importSteps(session.id, segment, stage, value.matchOutcome)}
            actions={session.publication?.status === "Queued" || session.publication?.status === "Running" ? null : <AttemptMenu session={session} />}
          />
        </PageContainer>
        {children}
      </div>
    </WorkforceImportFrameContext.Provider>
  );
}

function importSteps(sessionId: string, segment: string | null, stage: WorkforceImportStage, outcome: WorkforceMatchOutcome): ImportStep[] {
  return [
    { key: "upload", label: "Upload", state: "done" },
    {
      key: "match",
      label: "Match",
      detail: undefined,
      state: segment === "match" ? "current" : outcome !== "needed" ? "done" : "upcoming",
      href: segment === "review" ? workforceImportStageHref(sessionId, "match") : null,
    },
    {
      key: "review",
      label: "Review",
      state: segment === "review" ? "current" : "upcoming",
      href: segment === "match" && stage === "review" ? workforceImportStageHref(sessionId, "review") : null,
    },
  ];
}

/** Discard is the explicit way to close an attempt; nothing is ever discarded on the administrator's behalf. */
function AttemptMenu({ session }: { session: WorkforceImportSessionDto }) {
  const api = useWorkforceImportApi();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discard = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.discard(session.id, session.version);
      router.replace("/people/import");
    } catch (e) {
      setError(translateWorkforceImportError(e).message);
      setBusy(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Import actions">
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onClick={() => setOpen(true)}>
            <Trash2 className="size-4" aria-hidden />
            Discard import
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this import?</AlertDialogTitle>
            <AlertDialogDescription>
              The file and your decisions are removed. Nobody has been added to Fusion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? <p className="type-meta text-[var(--color-destructive)]">{error}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep import</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={busy} onClick={(e) => { e.preventDefault(); void discard(); }}>
              {busy ? "Discarding…" : "Discard import"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Publishing hands off to People: show the roster filling in, not a spinner. */
function Handoff() {
  return <EmployeesPageSkeleton />;
}

/** The attempt loading, shaped like the stage the URL names. */
function FrameSkeleton() {
  const segment = useSelectedLayoutSegment();
  return <ImportAttemptSkeleton domain="workforce" stage={segment === "match" || segment === "review" ? segment : null} />;
}
