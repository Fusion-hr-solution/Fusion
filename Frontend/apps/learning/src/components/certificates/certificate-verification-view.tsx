"use client";

import type { ReactNode } from "react";
import { CheckCircle2, ShieldX, XCircle } from "lucide-react";
import { Badge, Card, CardContent, Skeleton } from "@repo/ui";
import { useFormatter, useTranslations } from "next-intl";
import { useVerifyCertificate } from "@/hooks";
import type { CertificateVerification } from "@/types";

export function CertificateVerificationView({ certificateNumber }: { certificateNumber: string }) {
  const t = useTranslations("verify");
  const { data, isLoading, error } = useVerifyCertificate(certificateNumber);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md overflow-hidden border-t-4 border-t-[hsl(var(--ey-yellow))]">
        <CardContent className="p-8">
          <header className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground">
              <span className="text-sm font-bold text-[hsl(var(--ey-yellow))]">EY</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">EY Academy</p>
              <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
            </div>
          </header>

          {isLoading ? (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ) : error || !data ? (
            <div className="flex flex-col items-center py-6 text-center">
              <XCircle className="h-12 w-12 text-destructive" aria-hidden="true" />
              <p className="mt-3 text-base font-semibold text-foreground">{t("notFoundTitle")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.rich("notFoundBody", {
                  number: certificateNumber,
                  mono: (chunks) => <span className="font-mono">{chunks}</span>,
                })}
              </p>
            </div>
          ) : (
            <CertificateResult data={data} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CertificateResult({ data }: { data: CertificateVerification }) {
  const t = useTranslations("verify");
  const format = useFormatter();
  const isRevoked = data.status === "Revoked";

  return (
    <div>
      <div className="flex items-center gap-2">
        {isRevoked ? (
          <ShieldX className="h-6 w-6 text-destructive" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="h-6 w-6 text-emerald-600" aria-hidden="true" />
        )}
        <Badge variant={isRevoked ? "destructive" : "secondary"}>{isRevoked ? t("revoked") : t("valid")}</Badge>
      </div>
      <dl className="mt-5 space-y-3 text-sm">
        <Row label={t("awardedTo")} value={data.maskedEmployeeName} />
        <Row label={t("training")} value={data.trainingTitle} />
        <Row label={t("issued")} value={format.dateTime(new Date(data.issuedAt), { day: "2-digit", month: "short", year: "numeric" })} />
        <Row label={t("certificateNumber")} value={<span className="font-mono">{data.certificateNumber}</span>} />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/50 pb-2 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
