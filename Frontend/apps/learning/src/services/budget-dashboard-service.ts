import type {
  BudgetDashboardSummary,
  BudgetTrend,
  BudgetSpendDetail,
  BudgetFilters,
} from "@/types/admin";
import { client } from "./admin-service-mappers";

const BASE = "/training/admin/budgets/dashboard";

function buildFilterQuery(filters: BudgetFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.serviceLineId) params.set("serviceLineId", filters.serviceLineId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export async function getBudgetSummary(filters: BudgetFilters = {}): Promise<BudgetDashboardSummary> {
  return client.get<BudgetDashboardSummary>(`${BASE}/summary${buildFilterQuery(filters)}`);
}

export async function getBudgetTrend(filters: BudgetFilters = {}): Promise<BudgetTrend> {
  return client.get<BudgetTrend>(`${BASE}/trend${buildFilterQuery(filters)}`);
}

export async function getBudgetSpendDetail(
  serviceLineId: string,
  range: { from?: string; to?: string } = {},
): Promise<BudgetSpendDetail> {
  const params = new URLSearchParams();
  params.set("serviceLineId", serviceLineId);
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  return client.get<BudgetSpendDetail>(`${BASE}/detail?${params.toString()}`);
}

export async function exportBudgetReportExcel(filters: BudgetFilters = {}): Promise<Blob> {
  return client.get<Blob>(`${BASE}/export/excel${buildFilterQuery(filters)}`, { responseType: "blob" });
}

export async function exportBudgetReportPdf(filters: BudgetFilters = {}): Promise<Blob> {
  return client.get<Blob>(`${BASE}/export/pdf${buildFilterQuery(filters)}`, { responseType: "blob" });
}
