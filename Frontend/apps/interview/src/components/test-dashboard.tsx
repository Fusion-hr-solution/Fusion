"use client";
import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Archive, Clock, Eye, HelpCircle, Plus, Trash2, X } from "lucide-react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StatsRow } from "./stats-row";
import { FilterBar } from "./filter-bar";
import { TestCard } from "./test-card";
import { Pagination } from "./pagination";
import { useTestFilters } from "@/hooks/use-test-filters";
import {
  archiveTest,
  deleteTest,
  duplicateTest,
  getTestQuestions,
  getTests,
  setTestStatus,
} from "@/services/test-service";
import { useWizardStore } from "@/store/wizard-store";
import { cn } from "@/lib/utils";
import type { Question, Test, TestStatus } from "@/types";

type PendingAction =
  | { type: "archive"; test: Test }
  | { type: "delete"; test: Test }
  | null;

export function TestDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const resetWizard = useWizardStore((state) => state.reset);
  const setPersistedTestId = useWizardStore((state) => state.setPersistedTestId);
  const updateBasicInfo = useWizardStore((state) => state.updateBasicInfo);
  const updateConfig = useWizardStore((state) => state.updateConfig);
  const reorderQuestions = useWizardStore((state) => state.reorderQuestions);
  const setStep = useWizardStore((state) => state.setStep);
  const markSaved = useWizardStore((state) => state.markSaved);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [previewTest, setPreviewTest] = useState<Test | null>(null);
  const [previewQuestions, setPreviewQuestions] = useState<Question[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const previewRequestTokenRef = useRef(0);

  const requestedView = searchParams.get("view");
  const statusScope: TestStatus =
    requestedView === "draft"
      ? "Draft"
      : requestedView === "archived"
        ? "Archived"
        : "Active";

  const {
    data: tests = [],
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ["tests", statusScope],
    queryFn: () => getTests(statusScope),
  });

  const error = mutationError ?? (queryError instanceof Error ? queryError.message : queryError ? "Failed to load tests." : null);

  function invalidateTests(): Promise<void> {
    return queryClient.invalidateQueries({ queryKey: ["tests"] });
  }

  async function loadTestIntoWizard(test: Test, targetStep: number): Promise<void> {
    const selectedQuestions = await getTestQuestions(test.id);
    resetWizard();
    setPersistedTestId(test.id);
    updateBasicInfo({
      title: test.title,
      description: test.description,
      discipline: test.discipline,
    });
    updateConfig({
      maxAttempts: test.maxAttempts ?? 1,
      allowSkipping: test.allowSkipping,
      allowBacktracking: test.allowBacktracking,
      showProgressBar: test.showProgressBar,
      randomizeOrder: test.randomizeOrder,
    });
    reorderQuestions(selectedQuestions);
    setStep(targetStep);
    markSaved();
  }

  async function handleEdit(test: Test, targetStep = 1): Promise<void> {
    setActionBusyId(test.id);
    try {
      await loadTestIntoWizard(test, targetStep);
      router.push("/tests/create");
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Failed to load test for editing.");
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleOpenCandidatePreview(test: Test): Promise<void> {
    setActionBusyId(test.id);
    try {
      await loadTestIntoWizard(test, 4);
      closePreview();
      router.push("/tests/create/preview");
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Failed to open candidate view.");
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleDuplicate(test: Test): Promise<void> {
    setActionBusyId(test.id);
    try {
      await duplicateTest(test);
      await invalidateTests();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : "Failed to duplicate test.");
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleSetStatus(test: Test, status: TestStatus): Promise<void> {
    if (test.status === status) return;

    if (status === "Archived") {
      setPendingAction({ type: "archive", test });
      return;
    }

    setActionBusyId(test.id);
    try {
      await setTestStatus(test, status);
      await invalidateTests();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : `Failed to set status to ${status}.`);
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleDelete(test: Test): Promise<void> {
    setPendingAction({ type: "delete", test });
  }

  async function handlePreview(test: Test): Promise<void> {
    const requestToken = previewRequestTokenRef.current + 1;
    previewRequestTokenRef.current = requestToken;
    setPreviewTest(test);
    setPreviewQuestions([]);
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const questions = await getTestQuestions(test.id);
      if (previewRequestTokenRef.current !== requestToken) return;
      setPreviewQuestions(questions);
    } catch (err) {
      if (previewRequestTokenRef.current !== requestToken) return;
      setPreviewError(err instanceof Error ? err.message : "Failed to load test preview.");
    } finally {
      if (previewRequestTokenRef.current !== requestToken) return;
      setPreviewLoading(false);
    }
  }

  function closePreview(): void {
    previewRequestTokenRef.current += 1;
    setPreviewTest(null);
    setPreviewQuestions([]);
    setPreviewError(null);
    setPreviewLoading(false);
  }

  async function confirmPendingAction(): Promise<void> {
    if (!pendingAction) return;

    const { test, type } = pendingAction;
    setActionBusyId(test.id);
    try {
      if (type === "archive") {
        await archiveTest(test);
      } else {
        await deleteTest(test.id);
      }
      await invalidateTests();
    } catch (err) {
      setMutationError(
        err instanceof Error
          ? err.message
          : type === "archive"
            ? "Failed to archive test."
            : "Failed to delete test."
      );
    } finally {
      setActionBusyId(null);
      setPendingAction(null);
    }
  }

  const {
    filters,
    updateFilter,
    clearFilters,
    activeFilterCount,
    filtered,
    paginatedTests,
    currentPage,
    totalPages,
    setCurrentPage,
        } = useTestFilters(tests.filter((test) => test.status === statusScope));

  function navigateToView(view: "active" | "draft" | "archived"): void {
    router.push(view === "active" ? "/" : `/?view=${view}`);
  }

  return (
    <div className="flex flex-1 flex-col min-h-screen bg-zinc-50">
      {/* Page header */}
      <div className="border-b border-zinc-200 bg-white px-8 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900">
              Test Management
            </h1>
            <p className="mt-0.5 text-[13px] text-zinc-500">
              Manage and organize your assessments
            </p>
          </div>
          <button
            onClick={() => {
              resetWizard();
              router.push("/tests/create");
            }}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-all duration-150 hover:bg-zinc-700 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Create New Test
          </button>
        </div>

        {/* View switcher — browser-tab style consistent with candidate management */}
        <div className="mt-4 flex gap-0.5 overflow-x-auto scrollbar-hide border-b border-zinc-100 -mb-px">
          {[
            { key: "active" as const, label: "Active", status: "Active" as const },
            { key: "draft" as const, label: "Draft", status: "Draft" as const },
            { key: "archived" as const, label: "Archived", status: "Archived" as const },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => navigateToView(item.key)}
              className={cn(
                "inline-flex shrink-0 items-center rounded-t-lg border border-transparent px-4 py-2 text-[12px] font-medium transition-all duration-150",
                statusScope === item.status
                  ? "border-zinc-200 border-b-white bg-zinc-50 text-zinc-900 shadow-[0_-1px_3px_rgba(0,0,0,0.03)] -mb-px pb-[9px]"
                  : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50/60"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <StatsRow tests={tests} />

      <FilterBar
        filters={filters}
        activeFilterCount={activeFilterCount}
        resultCount={filtered.length}
        showStatusFilter={false}
        onFilterChange={updateFilter}
        onClearAll={clearFilters}
      />

      <div className="mx-8 border-t border-zinc-200" />

      {isLoading ? (
        <div className="flex min-h-[420px] items-center justify-center px-8 py-10">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
            <p className="text-[13px] font-medium text-zinc-600">Loading tests...</p>
          </div>
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="mx-8 mt-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          <X className="h-4 w-4 shrink-0 text-red-500" />
          {error}
        </div>
      ) : null}

      {!isLoading && !error && paginatedTests.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-28">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100">
            <Plus className="h-6 w-6 text-zinc-400" />
          </div>
          <div className="text-center">
            <p className="text-[15px] font-semibold text-zinc-900">No tests found</p>
            <p className="mt-1 text-[13px] text-zinc-500">
              Try adjusting your filters or create a new test.
            </p>
          </div>
          <button
            onClick={() => { resetWizard(); router.push("/tests/create"); }}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-[13px] font-semibold text-white transition-all duration-150 hover:bg-zinc-700 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Create New Test
          </button>
        </div>
      ) : !isLoading && !error ? (
        <div className="grid grid-cols-1 gap-4 px-8 py-4 sm:grid-cols-2 xl:grid-cols-3">
          {paginatedTests.map((test) => (
            <TestCard
              key={test.id}
              test={test}
              onOpen={(item) => void handleEdit(item, 4)}
              onEdit={(item) => void handleEdit(item)}
              onPreview={(item) => void handlePreview(item)}
              onDuplicate={(item) => void handleDuplicate(item)}
              onSetStatus={(item, status) => void handleSetStatus(item, status)}
              onDelete={(item) => void handleDelete(item)}
              isBusy={actionBusyId === test.id}
            />
          ))}
        </div>
           ) : null}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      <Dialog.Root
        open={previewTest !== null}
        onOpenChange={(open) => {
          if (!open) closePreview();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          {previewTest ? (
            <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[760px] max-w-[96vw] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 focus:outline-none">
              <div className="flex items-start justify-between border-b border-zinc-100 px-6 py-5">
                <div>
                  <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-700">
                    <Eye className="h-3.5 w-3.5" />
                    Preview Mode
                  </div>
                  <Dialog.Title className="text-[18px] font-bold text-zinc-900">
                    {previewTest.title}
                  </Dialog.Title>
                  <Dialog.Description className="mt-1 text-[13px] leading-relaxed text-zinc-500">
                    {previewTest.description || "No description provided."}
                  </Dialog.Description>
                </div>
                <Dialog.Close asChild>
                  <button
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-700"
                    aria-label="Close preview"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </Dialog.Close>
              </div>

              <div className="border-b border-zinc-100 bg-zinc-50/70 px-6 py-3">
                <div className="flex flex-wrap items-center gap-4 text-[12px] text-zinc-600">
                  <span className="flex items-center gap-1.5">
                    <HelpCircle className="h-3.5 w-3.5" />
                    {previewTest.questionCount} questions
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {previewQuestions.reduce((total, q) => total + q.durationMinutes, 0)} min total
                  </span>
                  <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
                    {previewQuestions.reduce((total, q) => total + q.points, 0)} pts total
                  </span>
                </div>
              </div>

              <div className="max-h-[58vh] overflow-y-auto px-6 py-5">
                {previewLoading ? (
                  <p className="text-[13px] text-zinc-500">Loading test details...</p>
                ) : null}

                {!previewLoading && previewError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-[13px] text-red-700">{previewError}</p>
                  </div>
                ) : null}

                {!previewLoading && !previewError && previewQuestions.length === 0 ? (
                  <p className="text-[13px] text-zinc-500">This test has no questions yet.</p>
                ) : null}

                {!previewLoading && !previewError && previewQuestions.length > 0 ? (
                  <div className="space-y-4">
                    {previewQuestions.map((question, idx) => (
                      <article key={question.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                        <div className="mb-2 flex items-center gap-2 text-[11px] text-zinc-500">
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-semibold text-zinc-700">
                            Question {idx + 1}
                          </span>
                          <span className="rounded-full border border-zinc-200 px-2 py-0.5">{question.type}</span>
                          <span className="rounded-full border border-zinc-200 px-2 py-0.5">{question.difficulty}</span>
                          <span className="ml-auto text-zinc-400">{question.points} pts</span>
                        </div>

                        <h3 className="text-[15px] font-semibold text-zinc-900">{question.title}</h3>
                        <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-600">
                          {question.description || "No prompt text provided."}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5">
                            {question.durationMinutes} min
                          </span>
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5">
                            {question.gradingMethod}
                          </span>
                          {question.tags.slice(0, 4).map((tag) => (
                            <span key={tag} className="rounded-full bg-zinc-100 px-2 py-0.5">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-6 py-4">
                <button
                  onClick={closePreview}
                  className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Close
                </button>
                <button
                  onClick={() => void handleOpenCandidatePreview(previewTest)}
                  disabled={previewLoading || Boolean(previewError) || actionBusyId === previewTest.id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-[13px] font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Candidate View
                </button>
              </div>
            </Dialog.Content>
          ) : null}
        </Dialog.Portal>
      </Dialog.Root>

      <AlertDialog.Root
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[440px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100">
              {pendingAction?.type === "archive" ? (
                <Archive className="h-5 w-5 text-zinc-700" />
              ) : (
                <Trash2 className="h-5 w-5 text-red-600" />
              )}
            </div>

            <AlertDialog.Title className="mt-3 text-[17px] font-semibold text-zinc-900">
              {pendingAction?.type === "archive" ? "Archive Test?" : "Delete Test?"}
            </AlertDialog.Title>

            <AlertDialog.Description className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">
              {pendingAction?.type === "archive"
                ? `Archive \"${pendingAction?.test.title}\"? You can still view it later in archived status.`
                : `Delete \"${pendingAction?.test.title}\"? This action cannot be undone.`}
            </AlertDialog.Description>

            <div className="mt-5 flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <button className="rounded-lg border border-zinc-200 px-4 py-2 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 transition-colors duration-150">
                  Cancel
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  onClick={() => void confirmPendingAction()}
                  disabled={actionBusyId !== null}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-[13px] font-semibold text-white hover:bg-zinc-800 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pendingAction?.type === "archive" ? "Archive" : "Delete"}
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}