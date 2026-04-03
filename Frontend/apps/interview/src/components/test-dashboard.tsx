"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { StatsRow } from "./stats-row";
import { FilterBar } from "./filter-bar";
import { TestCard } from "./test-card";
import { Pagination } from "./pagination";
import { useTestFilters } from "@/hooks/use-test-filters";
import { getTests } from "@/services/test-service";
import { useWizardStore } from "@/store/wizard-store";
import type { Test } from "@/types";

export function TestDashboard() {
  const router = useRouter();
   const resetWizard = useWizardStore((state) => state.reset);
  const [tests, setTests] = useState<Test[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getTests();
        if (isMounted) setTests(data);
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load tests.");
          setTests([]);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void load();
    return () => {
      isMounted = false;
    };
  }, []);

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
            <TestCard key={test.id} test={test} />
          ))}
        </div>
           ) : null}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}