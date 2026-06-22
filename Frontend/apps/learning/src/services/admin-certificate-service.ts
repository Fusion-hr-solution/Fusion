import { createPlatformApiClient } from "@repo/api";
import type {
  AdminCertificate,
  CertificateRegistryFilters,
  CertificateRegistryPage,
  CertificateStats,
  CertificateStatus,
} from "@/types";

const client = createPlatformApiClient();
const BASE = "/training/admin/certificates";

interface BackendRegistryRow {
  id: string;
  certificateNumber: string;
  employeeId: string;
  employeeFullName: string;
  gradeName?: string | null;
  serviceLineName?: string | null;
  trainingId: string;
  trainingTitle: string;
  credits: number;
  completedAt: string;
  issuedAt: string;
  status: string;
  revokedAt?: string | null;
  revokedReason?: string | null;
  revokedBy?: string | null;
}

interface BackendPaged<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

function mapStatus(status: string): CertificateStatus {
  return status === "Revoked" ? "Revoked" : "Valid";
}

function mapRow(r: BackendRegistryRow): AdminCertificate {
  return {
    id: r.id,
    certificateNumber: r.certificateNumber,
    employeeId: r.employeeId,
    employeeFullName: r.employeeFullName,
    gradeName: r.gradeName ?? undefined,
    serviceLineName: r.serviceLineName ?? undefined,
    trainingId: r.trainingId,
    trainingTitle: r.trainingTitle,
    credits: r.credits,
    completedAt: r.completedAt,
    issuedAt: r.issuedAt,
    status: mapStatus(r.status),
    revokedAt: r.revokedAt ?? undefined,
    revokedReason: r.revokedReason ?? undefined,
    revokedBy: r.revokedBy ?? undefined,
  };
}

function buildParams(f: CertificateRegistryFilters): Record<string, string> {
  const p: Record<string, string> = {};
  if (f.trainingId) p.trainingId = f.trainingId;
  if (f.gradeId) p.gradeId = f.gradeId;
  if (f.from) p.from = `${f.from}T00:00:00Z`;
  if (f.to) p.to = `${f.to}T23:59:59Z`;
  if (f.status) p.status = f.status;
  if (f.search) p.search = f.search;
  return p;
}

export async function getCertificateRegistry(
  filters: CertificateRegistryFilters,
  page: number,
  pageSize: number,
): Promise<CertificateRegistryPage> {
  const params = { ...buildParams(filters), page: String(page), pageSize: String(pageSize) };
  const data = await client.get<BackendPaged<BackendRegistryRow>>(BASE, { params });
  return { items: data.items.map(mapRow), totalCount: data.totalCount, page: data.page, pageSize: data.pageSize };
}

export async function getCertificateStats(): Promise<CertificateStats> {
  return client.get<CertificateStats>(`${BASE}/stats`);
}

export async function revokeCertificate(certificateId: string, reason: string): Promise<void> {
  await client.post(`${BASE}/${encodeURIComponent(certificateId)}/revoke`, { reason });
}

export async function reinstateCertificate(certificateId: string): Promise<void> {
  await client.post(`${BASE}/${encodeURIComponent(certificateId)}/reinstate`, {});
}

export async function exportCertificateRegistryExcel(filters: CertificateRegistryFilters): Promise<Blob> {
  return client.get<Blob>(`${BASE}/export/excel`, { params: buildParams(filters), responseType: "blob" });
}

export async function exportCertificateRegistryPdf(filters: CertificateRegistryFilters): Promise<Blob> {
  return client.get<Blob>(`${BASE}/export/pdf`, { params: buildParams(filters), responseType: "blob" });
}
