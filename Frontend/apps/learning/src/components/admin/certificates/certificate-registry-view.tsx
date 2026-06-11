"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Award, FileSpreadsheet, FileText } from "lucide-react";
import { Button, Skeleton } from "@repo/ui";
import { useApiQuery } from "@repo/api/react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { downloadBlob } from "@/lib/download";
import { downloadCertificatePdf } from "@/services/certificate-service";
import {
  exportCertificateRegistryExcel,
  exportCertificateRegistryPdf,
  getCertificateRegistry,
  getCertificateStats,
  reinstateCertificate,
} from "@/services/admin-certificate-service";
import { getAdminTrainings } from "@/services/admin-training-service";
import { getGrades } from "@/services/admin-config-service";
import type {
  AdminCertificate,
  CertificateRegistryFilters,
  CertificateRegistryPage,
  CertificateStats,
} from "@/types";
import type { AdminGrade, AdminTraining } from "@/types/admin";
import { CertificateRegistryFiltersBar } from "./certificate-registry-filters";
import { CertificateRegistryTable } from "./certificate-registry-table";
import { CertificateStatsCards } from "./certificate-stats-cards";
import { RevokeCertificateDialog } from "./revoke-certificate-dialog";

const PAGE_SIZE = 10;
const EMPTY_FILTERS: CertificateRegistryFilters = {};

export function CertificateRegistryView() {
  const t = useTranslations("adminCertificates");
  const tCommon = useTranslations("common");
  const [filters, setFilters] =
    useState<CertificateRegistryFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [revokeTarget, setRevokeTarget] = useState<AdminCertificate | null>(
    null
  );
  const [downloadingNumber, setDownloadingNumber] = useState<string | null>(
    null
  );
  const [exporting, setExporting] = useState(false);

  const fetchRegistry = useCallback(
    () => getCertificateRegistry(filters, page, PAGE_SIZE),
    [filters, page]
  );
  const {
    data: registry,
    isLoading,
    error,
    refetch,
  } = useApiQuery<CertificateRegistryPage>(fetchRegistry);

  const fetchStats = useCallback(() => getCertificateStats(), []);
  const { data: stats, refetch: refetchStats } =
    useApiQuery<CertificateStats>(fetchStats);

  const fetchTrainings = useCallback(
    () => getAdminTrainings({ pageSize: 100 }).then((r) => r.trainings),
    []
  );
  const { data: trainings } = useApiQuery<AdminTraining[]>(fetchTrainings);

  const fetchGrades = useCallback(() => getGrades(), []);
  const { data: grades } = useApiQuery<AdminGrade[]>(fetchGrades);

  function patchFilters(patch: Partial<CertificateRegistryFilters>) {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }

  async function viewPdf(cert: AdminCertificate) {
    setDownloadingNumber(cert.certificateNumber);
    try {
      downloadBlob(
        await downloadCertificatePdf(cert.certificateNumber),
        `${cert.certificateNumber}.pdf`
      );
    } catch {
      toast.error(t("toast.downloadError"));
    } finally {
      setDownloadingNumber(null);
    }
  }

  async function reinstate(cert: AdminCertificate) {
    try {
      await reinstateCertificate(cert.id);
      toast.success(t("toast.reinstated"));
      refetch();
      refetchStats();
    } catch {
      toast.error(t("toast.reinstateError"));
    }
  }

  async function runExport(kind: "excel" | "pdf") {
    setExporting(true);
    try {
      const blob =
        kind === "excel"
          ? await exportCertificateRegistryExcel(filters)
          : await exportCertificateRegistryPdf(filters);
      downloadBlob(
        blob,
        `certificate-registry.${kind === "excel" ? "xlsx" : "pdf"}`
      );
    } catch {
      toast.error(t("toast.exportError"));
    } finally {
      setExporting(false);
    }
  }

  const totalPages = registry
    ? Math.max(1, Math.ceil(registry.totalCount / PAGE_SIZE))
    : 1;

  return (
    <div className="min-h-screen bg-muted/20">
      <PageHeader
        moduleTitle={t("moduleTitle")}
        title={t("title")}
        description={t("description")}
      />
      <div className="space-y-5 px-8 py-8">
        {stats ? <CertificateStatsCards stats={stats} /> : null}

        <div className="flex flex-wrap items-start justify-between gap-3">
          <CertificateRegistryFiltersBar
            filters={filters}
            onChange={patchFilters}
            onClear={() => {
              setFilters(EMPTY_FILTERS);
              setPage(1);
            }}
            trainings={(trainings ?? []).map((t) => ({
              id: t.id,
              label: t.title,
            }))}
            grades={(grades ?? []).map((g) => ({ id: g.id, label: g.name }))}
          />
          <div className="flex gap-2 pt-5">
            <Button
              variant="outline"
              size="sm"
              disabled={exporting}
              onClick={() => runExport("excel")}
            >
              <FileSpreadsheet className="mr-1.5 h-4 w-4" aria-hidden="true" />{" "}
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={exporting}
              onClick={() => runExport("pdf")}
            >
              <FileText className="mr-1.5 h-4 w-4" aria-hidden="true" /> PDF
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-white">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <EmptyState
              icon={Award}
              title={t("errorTitle")}
              subtitle={t("errorSubtitle")}
            />
          ) : !registry || registry.items.length === 0 ? (
            <EmptyState
              icon={Award}
              title={t("emptyTitle")}
              subtitle={t("emptySubtitle")}
            />
          ) : (
            <>
              <CertificateRegistryTable
                items={registry.items}
                onViewPdf={viewPdf}
                onRevoke={setRevokeTarget}
                onReinstate={reinstate}
                downloadingNumber={downloadingNumber}
              />
              <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
                <span>
                  {t("certificateCount", { count: registry.totalCount })}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    {tCommon("actions.previous")}
                  </Button>
                  <span>{t("pageOf", { page, totalPages })}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {tCommon("actions.next")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <RevokeCertificateDialog
        certificate={revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onRevoked={() => {
          refetch();
          refetchStats();
        }}
      />
    </div>
  );
}
