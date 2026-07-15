"use client";

import { useCallback } from "react";
import { useApiQuery } from "@repo/api/react";
import { getBudgetSummary, getBudgetTrend, getBudgetSpendDetail } from "@/services/budget-dashboard-service";
import type { BudgetDashboardSummary, BudgetTrend, BudgetSpendDetail, BudgetFilters } from "@/types/admin";

export function useBudgetSummary(filters: BudgetFilters) {
  const fetcher = useCallback(() => getBudgetSummary(filters), [filters.serviceLineId, filters.from, filters.to]);
  return useApiQuery<BudgetDashboardSummary>(fetcher);
}

export function useBudgetTrend(filters: BudgetFilters) {
  const fetcher = useCallback(() => getBudgetTrend(filters), [filters.serviceLineId, filters.from, filters.to]);
  return useApiQuery<BudgetTrend>(fetcher);
}

export function useBudgetSpendDetail(serviceLineId: string, range: { from?: string; to?: string }) {
  const fetcher = useCallback(
    () => getBudgetSpendDetail(serviceLineId, range),
    [serviceLineId, range.from, range.to],
  );
  return useApiQuery<BudgetSpendDetail>(fetcher, { enabled: !!serviceLineId });
}
