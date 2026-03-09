"use client";

import { useState, useMemo } from "react";
import type { Test, DashboardFilterState, Discipline, QuestionType, TestStatus } from "@/types";
import { MOCK_TESTS } from "@/services/test-service";

export function useTestFilters() {
  const [filters, setFilters] = useState<DashboardFilterState>({
    search: "",
    disciplines: [],
    questionTypes: [],
    status: "All",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 9;

  const filteredTests = useMemo(() => {
    return MOCK_TESTS.filter((test) => {
      const matchesSearch =
        !filters.search ||
        test.title.toLowerCase().includes(filters.search.toLowerCase()) ||
        test.description.toLowerCase().includes(filters.search.toLowerCase()) ||
        test.role.toLowerCase().includes(filters.search.toLowerCase());

      const matchesDiscipline =
        filters.disciplines.length === 0 ||
        filters.disciplines.includes(test.discipline);

      const matchesType =
        filters.questionTypes.length === 0 ||
        test.questionTypes.some((t) => filters.questionTypes.includes(t));

      const matchesStatus =
        filters.status === "All" || test.status === filters.status;

      return matchesSearch && matchesDiscipline && matchesType && matchesStatus;
    });
  }, [filters]);

  const totalPages = Math.ceil(filteredTests.length / ITEMS_PER_PAGE);
  const paginatedTests = filteredTests.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const activeFilterCount =
    filters.disciplines.length +
    filters.questionTypes.length +
    (filters.status !== "All" ? 1 : 0);

  function toggleDiscipline(d: Discipline) {
    setCurrentPage(1);
    setFilters((prev) => ({
      ...prev,
      disciplines: prev.disciplines.includes(d)
        ? prev.disciplines.filter((x) => x !== d)
        : [...prev.disciplines, d],
    }));
  }

  function toggleQuestionType(t: QuestionType) {
    setCurrentPage(1);
    setFilters((prev) => ({
      ...prev,
      questionTypes: prev.questionTypes.includes(t)
        ? prev.questionTypes.filter((x) => x !== t)
        : [...prev.questionTypes, t],
    }));
  }

  function setStatus(s: TestStatus | "All") {
    setCurrentPage(1);
    setFilters((prev) => ({ ...prev, status: s }));
  }

  function setSearch(search: string) {
    setCurrentPage(1);
    setFilters((prev) => ({ ...prev, search }));
  }

  function clearFilters() {
    setCurrentPage(1);
    setFilters({ search: "", disciplines: [], questionTypes: [], status: "All" });
  }

  // Counts for filter badges
  const disciplineCounts = useMemo(() => {
    const map: Record<string, number> = {};
    MOCK_TESTS.forEach((t) => {
      map[t.discipline] = (map[t.discipline] || 0) + 1;
    });
    return map;
  }, []);

  const typeCounts = useMemo(() => {
    const map: Record<string, number> = {};
    MOCK_TESTS.forEach((t) =>
      t.questionTypes.forEach((qt) => {
        map[qt] = (map[qt] || 0) + 1;
      })
    );
    return map;
  }, []);

  return {
    filters,
    filteredTests,
    paginatedTests,
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
  };
}