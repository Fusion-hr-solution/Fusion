"use client";

import { useTranslations, useFormatter } from "next-intl";
import { Ban, Download, Loader2, RotateCcw } from "lucide-react";
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui";
import type { AdminCertificate } from "@/types";

interface CertificateRegistryTableProps {
  items: AdminCertificate[];
  onViewPdf: (cert: AdminCertificate) => void;
  onRevoke: (cert: AdminCertificate) => void;
  onReinstate: (cert: AdminCertificate) => void;
  downloadingNumber: string | null;
}

export function CertificateRegistryTable({
  items,
  onViewPdf,
  onRevoke,
  onReinstate,
  downloadingNumber,
}: CertificateRegistryTableProps) {
  const t = useTranslations("adminCertificates");
  const format = useFormatter();
  const formatDate = (iso: string) =>
    format.dateTime(new Date(iso), {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("table.certificateNumber")}</TableHead>
          <TableHead>{t("table.employee")}</TableHead>
          <TableHead>{t("table.grade")}</TableHead>
          <TableHead>{t("table.formation")}</TableHead>
          <TableHead>{t("table.issued")}</TableHead>
          <TableHead>{t("table.status")}</TableHead>
          <TableHead className="text-right">{t("table.actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((c) => {
          const revoked = c.status === "Revoked";
          return (
            <TableRow key={c.id}>
              <TableCell className="font-mono text-xs">
                {c.certificateNumber}
              </TableCell>
              <TableCell className="font-medium">
                {c.employeeFullName}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {c.gradeName ?? t("table.noGrade")}
              </TableCell>
              <TableCell>{c.trainingTitle}</TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(c.issuedAt)}
              </TableCell>
              <TableCell>
                <Badge variant={revoked ? "destructive" : "secondary"}>
                  {revoked ? t("status.revoked") : t("status.valid")}
                </Badge>
                {revoked && c.revokedReason ? (
                  <p
                    className="mt-1 max-w-[200px] truncate text-xs text-muted-foreground"
                    title={c.revokedReason}
                  >
                    {c.revokedReason}
                  </p>
                ) : null}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewPdf(c)}
                    disabled={downloadingNumber === c.certificateNumber}
                    aria-label={t("table.downloadAria", {
                      number: c.certificateNumber,
                    })}
                  >
                    {downloadingNumber === c.certificateNumber ? (
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Download className="h-4 w-4" aria-hidden="true" />
                    )}
                  </Button>
                  {revoked ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onReinstate(c)}
                      aria-label={t("table.reinstateAria", {
                        number: c.certificateNumber,
                      })}
                      title={t("table.reinstateTitle")}
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRevoke(c)}
                      className="text-destructive"
                      aria-label={t("table.revokeAria", {
                        number: c.certificateNumber,
                      })}
                    >
                      <Ban className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
