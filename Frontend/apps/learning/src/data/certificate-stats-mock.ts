import type { CertificateRegistryPage, CertificateStats } from "@/types";

/**
 * Fallback certificate stats used when the
 * `/training/admin/certificates/stats` endpoint is unavailable (e.g. local dev
 * with no backend running), matching the app's existing `MOCK_*` convention
 * (see `data/admin-overview.ts`). The view renders these so the KPIs and the
 * "issued by month" chart are visible without a live API.
 */

/** Builds a "YYYY-MM" key for the month `monthsAgo` before the current month. */
function monthKey(monthsAgo: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function buildMockCertificateStats(): CertificateStats {
  const counts = [8, 12, 9, 15, 11, 18];
  const byMonth = counts.map((count, i) => ({
    key: monthKey(counts.length - 1 - i),
    count,
  }));
  const total = 642;
  const revokedCount = 11;
  return {
    total,
    validCount: total - revokedCount,
    revokedCount,
    byTraining: [
      { key: "Cybersecurity Essentials", count: 142 },
      { key: "IFRS 17 Fundamentals", count: 118 },
      { key: "Data Privacy & GDPR", count: 96 },
      { key: "Leadership Foundations", count: 74 },
      { key: "Audit Methodology 2026", count: 63 },
    ],
    byMonth,
  };
}

export const MOCK_CERTIFICATE_STATS: CertificateStats = buildMockCertificateStats();

/** ISO timestamp for `daysAgo` before now (for realistic issued/revoked dates). */
function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

/**
 * Fallback registry page so the table — and the new "Revocation reason" column —
 * are visible in local dev without a backend. Rows deliberately cover all three
 * reason states: revoked with a reason, revoked without one, and valid.
 */
export const MOCK_CERTIFICATE_REGISTRY: CertificateRegistryPage = {
  page: 1,
  pageSize: 10,
  totalCount: 6,
  items: [
    {
      id: "c1",
      certificateNumber: "EY-CERT-2026-000142",
      employeeId: "e1",
      employeeFullName: "Amira Ben Salah",
      gradeName: "Senior",
      serviceLineName: "Assurance",
      trainingId: "t1",
      trainingTitle: "Cybersecurity Essentials",
      credits: 12,
      completedAt: daysAgo(9),
      issuedAt: daysAgo(8),
      status: "Valid",
    },
    {
      id: "c2",
      certificateNumber: "EY-CERT-2026-000138",
      employeeId: "e2",
      employeeFullName: "Youssef Harrabi",
      gradeName: "Staff",
      serviceLineName: "Consulting",
      trainingId: "t2",
      trainingTitle: "IFRS 17 Fundamentals",
      credits: 8,
      completedAt: daysAgo(21),
      issuedAt: daysAgo(20),
      status: "Revoked",
      revokedAt: daysAgo(4),
      revokedReason: "Issued against the wrong formation — re-issued under the correct course.",
      revokedBy: "HR Admin",
    },
    {
      id: "c3",
      certificateNumber: "EY-CERT-2026-000131",
      employeeId: "e3",
      employeeFullName: "Sofia Trabelsi",
      gradeName: "Manager",
      serviceLineName: "Tax",
      trainingId: "t3",
      trainingTitle: "Data Privacy & GDPR",
      credits: 10,
      completedAt: daysAgo(33),
      issuedAt: daysAgo(32),
      status: "Valid",
    },
    {
      id: "c4",
      certificateNumber: "EY-CERT-2026-000127",
      employeeId: "e4",
      employeeFullName: "Karim Mansour",
      gradeName: "Senior",
      serviceLineName: "Consulting",
      trainingId: "t4",
      trainingTitle: "Leadership Foundations",
      credits: 6,
      completedAt: daysAgo(48),
      issuedAt: daysAgo(47),
      status: "Revoked",
      revokedAt: daysAgo(12),
      revokedBy: "HR Admin",
    },
    {
      id: "c5",
      certificateNumber: "EY-CERT-2026-000119",
      employeeId: "e5",
      employeeFullName: "Nour El Houda",
      gradeName: "Staff",
      serviceLineName: "Assurance",
      trainingId: "t5",
      trainingTitle: "Audit Methodology 2026",
      credits: 14,
      completedAt: daysAgo(60),
      issuedAt: daysAgo(59),
      status: "Valid",
    },
    {
      id: "c6",
      certificateNumber: "EY-CERT-2026-000104",
      employeeId: "e6",
      employeeFullName: "Mehdi Gharbi",
      gradeName: "Manager",
      serviceLineName: "Tax",
      trainingId: "t1",
      trainingTitle: "Cybersecurity Essentials",
      credits: 12,
      completedAt: daysAgo(75),
      issuedAt: daysAgo(74),
      status: "Revoked",
      revokedAt: daysAgo(30),
      revokedReason: "Exam result later invalidated for academic-integrity reasons.",
      revokedBy: "HR Admin",
    },
  ],
};
