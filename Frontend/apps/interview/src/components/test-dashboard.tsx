"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Plus, Trash2 } from "lucide-react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
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
import type { Test, TestStatus } from "@/types";

type PendingAction =
  | { type: "archive"; test: Test }
  | { type: "delete"; test: Test }
  | null;

export function TestDashboard() {
  const router = useRouter();
  const resetWizard = useWizardStore((state) => state.reset);
  const setPersistedTestId = useWizardStore((state) => state.setPersistedTestId);
  const updateBasicInfo = useWizardStore((state) => state.updateBasicInfo);
  const reorderQuestions = useWizardStore((state) => state.reorderQuestions);
  const setStep = useWizardStore((state) => state.setStep);
  const markSaved = useWizardStore((state) => state.markSaved);
  const [tests, setTests] = useState<Test[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  async function loadTests(): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getTests();
      setTests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tests.");
      setTests([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      if (!isMounted) return;
      await loadTests();
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleEdit(test: Test): Promise<void> {
    setActionBusyId(test.id);
    try {
      const selectedQuestions = await getTestQuestions(test.id);
      resetWizard();
      setPersistedTestId(test.id);
      updateBasicInfo({
        title: test.title,
        description: test.description,
        discipline: test.discipline,
      });
      reorderQuestions(selectedQuestions);
      setStep(1);
      markSaved();
      router.push("/tests/create");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load test for editing.");
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleDuplicate(test: Test): Promise<void> {
    setActionBusyId(test.id);
    try {
      await duplicateTest(test);
      await loadTests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to duplicate test.");
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleArchive(test: Test): Promise<void> {
    setPendingAction({ type: "archive", test });
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
      await loadTests();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to set status to ${status}.`);
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleDelete(test: Test): Promise<void> {
    setPendingAction({ type: "delete", test });
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
      await loadTests();
    } catch (err) {
      setError(
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
        } = useTestFilters(tests);
  return (
    <div className="flex flex-1 flex-col min-h-screen bg-zinc-50">
      {/* Page header */}
      <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-8 py-5">
        <div>
          <h1 className="text-[24px] font-semibold text-zinc-900">
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
          className="flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-[14px] font-medium text-white hover:bg-zinc-700 transition-colors duration-150"
        >
          <Plus className="h-4 w-4" />
          Create New Test
        </button>
      </div>

      <StatsRow tests={tests} />

      <FilterBar
        filters={filters}
        activeFilterCount={activeFilterCount}
        resultCount={filtered.length}
        onFilterChange={updateFilter}
        onClearAll={clearFilters}
      />

      <div className="mx-8 border-t border-zinc-200" />

      {isLoading ? (
        <div className="px-8 py-6 text-[13px] text-zinc-500">Loading tests...</div>
      ) : null}

      {!isLoading && error ? (
        <div className="mx-8 mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-[13px] text-red-700">{error}</p>
        </div>
      ) : null}

      {!isLoading && !error && paginatedTests.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
            <Plus className="h-6 w-6 text-zinc-400" />
          </div>
          <p className="text-[15px] font-medium text-zinc-900">
            No tests found
          </p>
          <p className="text-[13px] text-zinc-500">
            Try adjusting your filters or create a new test
          </p>
        </div>
      ) : !isLoading && !error ? (
        <div className="grid grid-cols-3 gap-4 px-8 py-4">
          {paginatedTests.map((test) => (
            <TestCard
              key={test.id}
              test={test}
              onEdit={(item) => void handleEdit(item)}
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