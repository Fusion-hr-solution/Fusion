"use client";

import { useState, useMemo } from "react";
import type { Test, FilterState } from "@/types";

export function useTestFilters(tests: Test[]) {
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    discipline: "",
    questionType: "",
    status: "",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 9;

  function updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  }

  function clearFilters() {
    setFilters({ search: "", discipline: "", questionType: "", status: "" });
    setCurrentPage(1);
  }

  const activeFilterCount = [
    filters.discipline,
    filters.questionType,
    filters.status,
  ].filter(Boolean).length;

  const filtered = useMemo(() => {
    return tests.filter((test) => {
      const matchesSearch =
        !filters.search ||
        test.title.toLowerCase().includes(filters.search.toLowerCase()) ||
        test.description.toLowerCase().includes(filters.search.toLowerCase());

      const matchesDiscipline = !filters.discipline || test.discipline === filters.discipline;
      const matchesType = !filters.questionType || test.questionTypes.includes(filters.questionType);
      const matchesStatus = !filters.status || test.status === filters.status;

      return matchesSearch && matchesDiscipline && matchesType && matchesStatus;
    });
  }, [tests, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedTests = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return {
    filters,
    updateFilter,
    clearFilters,
    activeFilterCount,
    filtered,
    paginatedTests,
    currentPage,
    totalPages,
    setCurrentPage,
  };
}