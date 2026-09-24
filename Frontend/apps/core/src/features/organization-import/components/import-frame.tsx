"use client";

import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Button, Spinner } from "@repo/ds";
import {
  PageContainer,
  PageHeader,
  PagePermissionNotice,
} from "@repo/ds/shell";
import {
  translateOrganizationImportError,
  type OrganizationImportSessionDto,
} from "@repo/api";
import { ImportHeader } from "./import-header";
import {
  ImportAttemptSkeleton,
  type ImportSkeletonStage,
} from "./import-skeletons";
import type { ImportStep } from "./import-stepper";
import { useBreadcrumbLabel } from "@/shell/breadcrumb-overrides";
import { useOrganizationImportSession } from "../api/use-organization-import";
import {
  deriveImportStage,
  deriveMatchOutcome,
  importStageHref,
  type ImportStage,
  type MatchOutcome,
} from "../model/import-stage";
import { ImportAccessGate } from "./organization-import-workspace";

type ImportFrameValue = {
  session: OrganizationImportSessionDto;
  stage: ImportStage;
  matchOutcome: MatchOutcome;
  refetch: () => void;
  /** Hold the stage guard while a publish is in flight, so the committed attempt never redirects itself. */
  beginPublish: () => void;
  /** Settle a publish: on success the frame holds one calm hand-off until the browser lands on Organization. */
  endPublish: (published: boolean) => void;
};

const ImportFrameContext = createContext<ImportFrameValue | null>(null);

export function useImportFrame(): ImportFrameValue {
  const value = useContext(ImportFrameContext);
  if (!value)
    throw new Error(
      "useImportFrame must be used inside OrganizationImportFrame"
    );
  return value;
}

/**
 * The frame every stage of one import attempt renders inside (`/organization/import/{id}/…`).
 * It owns the session, derives the attempt's stage, keeps the URL honest about it, and draws
 * the shell: file, effective date, journey, exit and discard. Stages own everything else.
 */
export function OrganizationImportFrame({
  sessionId,
  children,
}: {
  sessionId: string;
  children: React.ReactNode;
}) {
  const segment = useSelectedLayoutSegment();
  return (
    <ImportAccessGate
      skeleton={<ImportAttemptSkeleton stage={segmentStage(segment)} />}
    >
      <ImportFrameBody sessionId={sessionId}>{children}</ImportFrameBody>
    </ImportAccessGate>
  );
}

function ImportFrameBody({
  sessionId,
  children,
}: {
  sessionId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const segment = useSelectedLayoutSegment();
  const sessionQuery = useOrganizationImportSession(sessionId);
  const session = sessionQuery.data ?? null;
  const publishingRef = useRef(false);
  const [handoff, setHandoff] = useState(false);
  useBreadcrumbLabel(sessionId, session?.source.originalFileName);

  const stage = session ? deriveImportStage(session) : null;
  const target = session && stage ? guardTarget(session, stage, segment) : null;

  useEffect(() => {
    if (!target || handoff || publishingRef.current) return;
    router.replace(target);
  }, [target, handoff, router]);

  const value: ImportFrameValue | null =
    session && stage
      ? {
          session,
          stage,
          matchOutcome: deriveMatchOutcome(session),
          refetch: () => void sessionQuery.refetch(),
          beginPublish: () => {
            publishingRef.current = true;
          },
          endPublish: (published) => {
            if (published) setHandoff(true);
            else publishingRef.current = false;
          },
        }
      : null;

  if (handoff || (publishingRef.current && stage === "committed"))
    return <ImportHandoff />;
  if (sessionQuery.isLoading)
    return <ImportAttemptSkeleton stage={segmentStage(segment)} />;
  if (sessionQuery.error)
    return (
      <PageContainer className="space-y-6">
        <PageHeader title="Import organization structure" />
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
  // While the guard moves the URL, show the stage the attempt is heading to.
  if (!value || target)
    return (
      <ImportAttemptSkeleton
        stage={
          stage === "match" || stage === "review"
            ? stage
            : segmentStage(segment)
        }
      />
    );

  return (
    <ImportFrameContext.Provider value={value}>
      <OrganizationImportShell segment={segment}>
        {children}
      </OrganizationImportShell>
    </ImportFrameContext.Provider>
  );
}

/**
 * Where the attempt belongs when the current URL doesn't reflect it, or null when it does.
 * A finished attempt leaves the import, the bare attempt URL resolves to its current stage,
 * and Review is unreachable until Match is complete. Match stays reachable from Review:
 * revisiting it is the administrator's choice.
 */
function guardTarget(
  session: OrganizationImportSessionDto,
  stage: ImportStage,
  segment: string | null
): string | null {
  if (stage === "committed")
    return `/organization?asOf=${encodeURIComponent(session.effectiveDate)}`;
  if (stage === "discarded") return "/organization/import";
  if (segment !== "match" && segment !== "review")
    return importStageHref(session.id, stage);
  if (segment === "review" && stage === "match")
    return importStageHref(session.id, "match");
  return null;
}

function OrganizationImportShell({
  segment,
  children,
}: {
  segment: string | null;
  children: React.ReactNode;
}) {
  const { session, stage, matchOutcome } = useImportFrame();
  // Match and Review are documents that scroll with the shell, header included, each with a
  // flow bar pinned to the bottom, rather than panes clipped under a pinned band.
  return (
    <div>
      <PageContainer>
        <ImportHeader
          context="Bring in your structure from Excel or CSV and review it before publishing."
          steps={importSteps(session.id, segment, stage, matchOutcome)}
        />
      </PageContainer>
      {children}
    </div>
  );
}

/**
 * Upload → Match → Review. Upload is always behind an open attempt. Match reads as settled
 * once the interpretation is complete, and says so when Fusion needed no help. Settled or
 * reachable stages are links, so the journey is also how the administrator moves between them.
 */
function importSteps(
  sessionId: string,
  segment: string | null,
  stage: ImportStage,
  matchOutcome: MatchOutcome
): ImportStep[] {
  const matchDone = matchOutcome !== "needed";
  return [
    { key: "upload", label: "Upload", state: "done" },
    {
      key: "match",
      label: "Match",
      detail:
        matchOutcome === "automatic" ? "Automatically matched" : undefined,
      state: segment === "match" ? "current" : matchDone ? "done" : "upcoming",
      href: segment === "review" ? importStageHref(sessionId, "match") : null,
    },
    {
      key: "review",
      label: "Review",
      state: segment === "review" ? "current" : "upcoming",
      href:
        segment === "match" && stage === "review"
          ? importStageHref(sessionId, "review")
          : null,
    },
  ];
}

function ImportHandoff() {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      <Spinner className="size-6" aria-hidden />
      <p>Publishing organization…</p>
    </div>
  );
}

/** The stage a URL segment names, for the skeleton shown before the attempt resolves. */
function segmentStage(segment: string | null): ImportSkeletonStage | null {
  return segment === "match" || segment === "review" ? segment : null;
}
