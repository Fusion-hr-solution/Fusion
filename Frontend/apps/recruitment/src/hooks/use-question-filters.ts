"use client";

import { useState, useMemo } from "react";
import type { Question, QuestionType, Difficulty, GradingMethod } from "@/types";
import { MOCK_QUESTIONS } from "@/services/test-service";

interface QuestionFilterState {
  search: string;
  types: QuestionType[];
  difficulties: Difficulty[];
  gradingMethods: GradingMethod[];
}

export function useQuestionFilters() {
  const [filters, setFilters] = useState<QuestionFilterState>({
    search: "",
    types: [],
    difficulties: [],
    gradingMethods: [],
  });

  const [currentPage, setCurrentPage] = useState(1);
  const PER_PAGE = 6;

  const filtered = useMemo(() => {
    return MOCK_QUESTIONS.filter((q) => {
      const matchesSearch =
        !filters.search ||
        q.title.toLowerCase().includes(filters.search.toLowerCase()) ||
        q.description.toLowerCase().includes(filters.search.toLowerCase()) ||
        q.tags.some((t) => t.toLowerCase().includes(filters.search.toLowerCase()));

      const matchesType =
        filters.types.length === 0 || filters.types.includes(q.type);

      const matchesDifficulty =
        filters.difficulties.length === 0 ||
        filters.difficulties.includes(q.difficulty);

      const matchesGrading =
        filters.gradingMethods.length === 0 ||
        filters.gradingMethods.includes(q.gradingMethod);

      return matchesSearch && matchesType && matchesDifficulty && matchesGrading;
    });
  }, [filters]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  const activeFilterCount =
    filters.types.length + filters.difficulties.length + filters.gradingMethods.length;

  function toggleType(t: QuestionType) {
    setCurrentPage(1);
    setFilters((prev) => ({
      ...prev,
      types: prev.types.includes(t)
        ? prev.types.filter((x) => x !== t)
        : [...prev.types, t],
    }));
  }

  function toggleDifficulty(d: Difficulty) {
    setCurrentPage(1);
    setFilters((prev) => ({
      ...prev,
      difficulties: prev.difficulties.includes(d)
        ? prev.difficulties.filter((x) => x !== d)
        : [...prev.difficulties, d],
    }));
  }

  function toggleGrading(g: GradingMethod) {
    setCurrentPage(1);
    setFilters((prev) => ({
      ...prev,
      gradingMethods: prev.gradingMethods.includes(g)
        ? prev.gradingMethods.filter((x) => x !== g)
        : [...prev.gradingMethods, g],
    }));
  }

  function setSearch(search: string) {
    setCurrentPage(1);
    setFilters((prev) => ({ ...prev, search }));
  }

  function clearFilters() {
    setCurrentPage(1);
    setFilters({ search: "", types: [], difficulties: [], gradingMethods: [] });
  }

  const typeCounts = useMemo(() => {
    const map: Record<string, number> = {};
    MOCK_QUESTIONS.forEach((q) => {
      map[q.type] = (map[q.type] || 0) + 1;
    });
    return map;
  }, []);

  const difficultyCounts = useMemo(() => {
    const map: Record<string, number> = {};
    MOCK_QUESTIONS.forEach((q) => {
      map[q.difficulty] = (map[q.difficulty] || 0) + 1;
    });
    return map;
  }, []);

  const gradingCounts = useMemo(() => {
    const map: Record<string, number> = {};
    MOCK_QUESTIONS.forEach((q) => {
      map[q.gradingMethod] = (map[q.gradingMethod] || 0) + 1;
    });
    return map;
  }, []);

  return {
    filters,
    filtered,
    paginated,
    currentPage,
    totalPages,
    activeFilterCount,
    typeCounts,
    difficultyCounts,
    gradingCounts,
    setSearch,
    toggleType,
    toggleDifficulty,
    toggleGrading,
    clearFilters,
    setCurrentPage,
  };
}