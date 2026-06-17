"use client";

import { useState } from "react";
import { Award, Download, Loader2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Badge, Button, Card, CardContent } from "@repo/ui";
import { toast } from "sonner";
import { downloadBlob } from "@/lib/download";
import { downloadCertificatePdf } from "@/services";
import type { MyCertificate } from "@/types";
import { CertificateShareMenu } from "./certificate-share-menu";

export function CertificateCard({
  certificate,
}: {
  certificate: MyCertificate;
}) {
  const t = useTranslations("certificates");
  const format = useFormatter();
  const [downloading, setDownloading] = useState(false);
  const isRevoked = certificate.status === "Revoked";
  const subtitle = [certificate.gradeName, certificate.serviceLineName]
    .filter(Boolean)
    .join(" · ");

  async function handleDownload() {
    setDownloading(true);
    try {
      const blob = await downloadCertificatePdf(certificate.certificateNumber);
      downloadBlob(blob, `${certificate.certificateNumber}.pdf`);
    } catch {
      toast.error(t("downloadError"));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Card className="ey-animate-fade-up overflow-hidden">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--ey-yellow))]/15">
            <Award className="h-5 w-5 text-foreground" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-foreground">
                {certificate.trainingTitle}
              </h3>
              <Badge variant={isRevoked ? "destructive" : "secondary"}>
                {isRevoked ? t("revoked") : t("valid")}
              </Badge>
            </div>
            {subtitle ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {certificate.certificateNumber}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("issuedLine", {
                date: format.dateTime(new Date(certificate.issuedAt), {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                }),
                credits: certificate.credits,
              })}
              {certificate.duration ? ` · ${certificate.duration}` : ""}
            </p>
            {isRevoked && certificate.revokedReason ? (
              <p className="mt-1 text-xs text-destructive">
                {t("revokedReason", { reason: certificate.revokedReason })}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <CertificateShareMenu certificate={certificate} />
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={downloading}
            aria-label={t("downloadAria", {
              number: certificate.certificateNumber,
            })}
          >
            {downloading ? (
              <Loader2
                className="mr-1.5 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
            )}
            PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
