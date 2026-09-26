"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@repo/ds";
import { PageContainer } from "@repo/ds/shell";
import { useQueryClient } from "@tanstack/react-query";
import {
  coreWorkforceImportQueryKeys,
  translateWorkforceImportError,
  type WorkforceApplyStatusDto,
  type WorkforceImportSessionDto,
  type WorkforceResolutionsUpdateRequest,
  type WorkforceReviewCountsDto,
  type WorkforceReviewRowDto,
} from "@repo/api";
import { ImportReviewFooter } from "@/features/data-import/components/review-footer";
import { formatWorkforceDate } from "@/features/people/components/workforce-ui";
import { useWorkforceApplyStatus, useWorkforceImportApi, useWorkforceReview, useWorkforceSessionCache } from "../api/use-workforce-import";
import { workforceImportStageHref } from "../model/import-stage";
import { reviewNotices, type ReviewFilter, type ReviewNotice } from "../model/review-view";
import { useWorkforceImportFrame } from "./workforce-import-frame";
import { WorkforceApplyState } from "./workforce-apply-state";
import { REVIEW_PAGE_SIZE, WorkforceProposal } from "./workforce-review-proposal";
import { WorkforceReviewInspector } from "./workforce-review-inspector";
import { WorkforceReviewBanner, WorkforceReviewNotices } from "./workforce-review-summary";

/**
 * Review: the exact workforce Fusion will establish, read-only, and its publication. A row opens the
 * person's details; a blocked row offers only the resolutions its issue allows. Publish confirms what
 * will be written and sends the reviewed proposal fingerprint, so the server publishes exactly that.
 * The publication runs in the background and is followed here until Fusion lands on the new people.
 */
export function WorkforceReviewStage() {
  const { session, refetch, beginPublish, endPublish } = useWorkforceImportFrame();
  const api = useWorkforceImportApi();
  const cache = useWorkforceSessionCache();
  const queryClient = useQueryClient();
  const router = useRouter();
  const matchHref = workforceImportStageHref(session.id, "match");

  const [filter, setFilter] = useState<ReviewFilter>("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<WorkforceReviewRowDto | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const openFirstBlocked = useRef(false);

  const [busy, setBusy] = useState(false);
  const [changingAsOf, setChangingAsOf] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [changed, setChanged] = useState(false);
  const inFlight = session.publication?.status === "Queued" || session.publication?.status === "Running";
  const [publishing, setPublishing] = useState(inFlight);
  const status = useWorkforceApplyStatus(session.id, publishing);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const review = useWorkforceReview(session.id, { filter, query: search, page, pageSize: REVIEW_PAGE_SIZE });
  const rows = useMemo(() => review.data?.rows ?? [], [review.data]);
  const summary = review.data?.summary;
  const counts = summary?.counts ?? countsFrom(session);
  const notices = useMemo(() => {
    const list = reviewNotices(counts, summary?.issueGroups ?? [], formatWorkforceDate(session.baselineDate));
    return changed ? [CHANGED, ...list] : list;
  }, [counts, summary, session.baselineDate, changed]);

  // Keep the open person current as the proposal re-derives; after a resolution clears them from the
  // queue, move on to the next person who still needs attention, or close.
  useEffect(() => {
    if (review.isFetching) return;
    if (openFirstBlocked.current && filter === "Blocked") {
      openFirstBlocked.current = false;
      const first = rows.find((r) => r.classification === "Blocked");
      if (first) {
        setSelected(first);
        setSheetOpen(true);
      }
      return;
    }
    if (!selected) return;
    const current = rows.find((r) => r.sourceRowNumber === selected.sourceRowNumber);
    const resolved = selected.classification === "Blocked" && current?.classification !== "Blocked";
    if (!resolved) {
      if (current && current !== selected) setSelected(current);
      return;
    }
    if (!sheetOpen) return setSelected(current ?? null);
    const next = rows.find((r) => r.classification === "Blocked") ?? current;
    if (next) setSelected(next);
    else setSheetOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, review.isFetching]);

  // When the last blocker clears, "Needs attention" is empty: show everyone instead.
  useEffect(() => {
    if (filter === "Blocked" && counts.blocked === 0) {
      setFilter("");
      setPage(1);
    }
  }, [counts.blocked, filter]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: coreWorkforceImportQueryKeys.all() });
    refetch();
  };

  useEffect(() => {
    const current = status.data;
    if (!publishing || !current) return;
    if (current.status === "Succeeded") {
      endPublish(true);
      router.replace(`/people?importBatch=${session.id}`);
    } else if (current.status === "ReviewOutdated" || current.status === "Failed") {
      endPublish(false);
      setPublishing(false);
      setChanged(current.status === "ReviewOutdated");
      if (current.status === "Failed") toast.error("The workforce was not published", { description: current.message ?? undefined });
      void refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.data, publishing]);

  const showView = (next: ReviewFilter) => {
    setFilter(next);
    setPage(1);
  };

  const onNotice = (notice: ReviewNotice) => {
    if (notice.key === CHANGED.key) return setChanged(false);
    if (notice.filter === "Blocked") openFirstBlocked.current = true;
    setSearchInput("");
    setSearch("");
    showView(notice.filter);
  };

  const resolve = async (resolution: WorkforceResolutionsUpdateRequest) => {
    setBusy(true);
    try {
      await api.updateResolutions(session.id, session.version, resolution);
      await refresh();
    } catch (e) {
      toast.error("The proposal was not updated", { description: translateWorkforceImportError(e).message });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const changeAsOf = async (date: string) => {
    setChangingAsOf(true);
    try {
      await cache(await api.changeBaseline(session.id, session.version, date));
      setPage(1);
    } catch (e) {
      toast.error("The workforce date was not changed", { description: translateWorkforceImportError(e).message });
      await refresh();
    } finally {
      setChangingAsOf(false);
    }
  };

  const publish = async () => {
    if (!session.proposalFingerprint) return;
    setBusy(true);
    setChanged(false);
    beginPublish();
    try {
      await api.commit(session.id, session.version, session.proposalFingerprint);
      setConfirming(false);
      setPublishing(true);
    } catch (e) {
      endPublish(false);
      const problem = translateWorkforceImportError(e);
      setConfirming(false);
      if (problem.code === "ProposalChanged") setChanged(true);
      else toast.error("The workforce was not published", { description: problem.message });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    setBusy(true);
    try {
      await api.discard(session.id, session.version);
      router.replace("/people/import");
    } catch (e) {
      toast.error("The import was not discarded", { description: translateWorkforceImportError(e).message });
      setBusy(false);
    }
  };

  if (publishing)
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-6 py-8">
        <WorkforceApplyState
          status={status.data ?? session.publication ?? QUEUED}
          onReturnToReview={() => setPublishing(false)}
          onRetry={() => setConfirming(true)}
        />
      </div>
    );

  const noop = counts.blocked === 0 && counts.create === 0;
  return (
    <section aria-label="Review">
      <PageContainer className="space-y-4 pt-2">
        <WorkforceReviewBanner counts={counts} asOf={session.baselineDate} changingAsOf={changingAsOf} onChangeAsOf={(d) => void changeAsOf(d)} />
        <WorkforceReviewNotices notices={notices} onView={onNotice} />
        <WorkforceProposal
          counts={counts}
          baseline={session.baselineDate}
          rows={rows}
          totalMatching={review.data?.totalMatching ?? 0}
          loading={review.isLoading || review.isFetching}
          filter={filter}
          onFilter={showView}
          search={searchInput}
          onSearch={setSearchInput}
          page={page}
          onPage={setPage}
          selected={sheetOpen ? (selected?.sourceRowNumber ?? null) : null}
          onSelect={(row) => {
            setSelected(row);
            setSheetOpen(true);
          }}
        />
      </PageContainer>

      <ImportReviewFooter
        matchHref={matchHref}
        blockingCount={counts.openDecisionCount}
        canPublish={counts.blocked === 0 && (noop || session.canPublish)}
        noop={noop}
        busy={busy}
        publishLabel="Publish workforce"
        noopLabel={{ idle: "Discard import", busy: "Discarding…", status: "Nothing to import", variant: "outline" }}
        onPublish={() => (noop ? void discard() : setConfirming(true))}
      />

      <Sheet open={sheetOpen && selected !== null} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
          <SheetTitle className="sr-only">{selected?.employee.displayName ?? "Employee"}</SheetTitle>
          <SheetDescription className="sr-only">What publishing does with this person.</SheetDescription>
          <WorkforceReviewInspector
            row={selected}
            baseline={session.baselineDate}
            sessionId={session.id}
            matchHref={matchHref}
            busy={busy}
            onDecide={(r) => void resolve(r)}
          />
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Add {counts.create} {counts.create === 1 ? "employee" : "employees"} to Fusion?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They join as of {formatWorkforceDate(session.baselineDate)} with their organization and manager.
              {counts.existing > 0 ? ` ${counts.existing} already in Fusion stay unchanged.` : ""}
              {counts.notImported > 0 ? ` ${counts.notImported} ${counts.notImported === 1 ? "isn't" : "aren't"} imported.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep reviewing</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void publish();
              }}
            >
              {busy ? "Publishing…" : "Publish workforce"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

/** The attempt's own counts, until the first review page answers. */
function countsFrom(session: WorkforceImportSessionDto): WorkforceReviewCountsDto {
  const c = session.counts;
  return {
    ...c,
    total: session.source.rowCount ?? c.create + c.existing + c.notImported + c.blocked,
    openDecisionCount: c.blocked,
  };
}

const CHANGED: ReviewNotice = {
  key: "changed",
  tone: "warning",
  count: null,
  title: "The workforce changed since you reviewed it",
  detail: "This is the current proposal. Look it over before publishing.",
  action: "Dismiss",
  filter: "",
};

const QUEUED: WorkforceApplyStatusDto = {
  status: "Queued",
  phase: "Preparing",
  processed: 0,
  total: null,
  result: null,
  reviewOutdated: null,
  message: null,
};
