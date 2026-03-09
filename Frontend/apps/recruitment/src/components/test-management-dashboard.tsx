"use client";

import { useState } from "react";
import { TopNav } from "./top-nav";
import { FilterSidebar } from "./filter-sidebar";
import { StatsRow } from "./stats-row";
import { DashboardActions } from "./dashboard-actions";
import { TestGrid } from "./test-grid";
import { CreateTestWizard } from "./create-test-wizard";
import { useTestFilters } from "@/hooks/use-test-filters";

export function TestManagementDashboard() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const {
    filters,
    paginatedTests,
    filteredTests,
    currentPage,
    totalPages,
    activeFilterCount,
    disciplineCounts,
    typeCounts,
    setSearch,
    toggleDiscipline,
    toggleQuestionType,
    setStatus,
    clearFilters,
    setCurrentPage,
  } = useTestFilters();

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <TopNav />

      <div className="flex flex-1 overflow-hidden">
        <FilterSidebar
          filters={filters}
          activeFilterCount={activeFilterCount}
          disciplineCounts={disciplineCounts}
          typeCounts={typeCounts}
          onSearch={setSearch}
          onToggleDiscipline={toggleDiscipline}
          onToggleType={toggleQuestionType}
          onSetStatus={setStatus}
          onClear={clearFilters}
        />

        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Page header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Test Management</h1>
                <p className="text-sm text-zinc-500 mt-1">
                  Create, manage and track technical assessments across all disciplines.
                </p>
              </div>
              <DashboardActions onCreateNew={() => setWizardOpen(true)} />
            </div>

            <StatsRow />

            <TestGrid
              tests={paginatedTests}
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={filteredTests.length}
              onPageChange={setCurrentPage}
            />
          </div>
        </main>
      </div>

      {wizardOpen && <CreateTestWizard onClose={() => setWizardOpen(false)} />}
    </div>
  );
}