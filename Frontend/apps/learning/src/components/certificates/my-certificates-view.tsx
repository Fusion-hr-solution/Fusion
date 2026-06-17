"use client";

import { Award } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@repo/ui";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { useMyCertificates } from "@/hooks";
import { CertificateCard } from "./certificate-card";

export function MyCertificatesView() {
  const t = useTranslations("certificates");
  const { data, isLoading, error } = useMyCertificates();

  return (
    <div className="min-h-screen bg-muted/20">
      <PageHeader
        moduleTitle={t("moduleTitle")}
        title={t("title")}
        description={t("description")}
      />
      <div className="px-8 py-8">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={Award}
            title={t("errorTitle")}
            subtitle={t("errorSubtitle")}
          />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={Award}
            title={t("emptyTitle")}
            subtitle={t("emptySubtitle")}
          />
        ) : (
          <div className="ey-stagger-list space-y-3">
            {data.map((certificate) => (
              <CertificateCard key={certificate.id} certificate={certificate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
