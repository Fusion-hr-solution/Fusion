"use client";

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function CertificateRegistryTable({
  items,
  onViewPdf,
  onRevoke,
  onReinstate,
  downloadingNumber,
}: CertificateRegistryTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Certificate №</TableHead>
          <TableHead>Employee</TableHead>
          <TableHead>Grade</TableHead>
          <TableHead>Formation</TableHead>
          <TableHead>Issued</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((c) => {
          const revoked = c.status === "Revoked";
          return (
            <TableRow key={c.id}>
              <TableCell className="font-mono text-xs">{c.certificateNumber}</TableCell>
              <TableCell className="font-medium">{c.employeeFullName}</TableCell>
              <TableCell className="text-muted-foreground">{c.gradeName ?? "—"}</TableCell>
              <TableCell>{c.trainingTitle}</TableCell>
              <TableCell className="text-muted-foreground">{formatDate(c.issuedAt)}</TableCell>
              <TableCell>
                <Badge variant={revoked ? "destructive" : "secondary"}>{revoked ? "Revoked" : "Valid"}</Badge>
                {revoked && c.revokedReason ? (
                  <p className="mt-1 max-w-[200px] truncate text-xs text-muted-foreground" title={c.revokedReason}>
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
                    aria-label={`Download PDF for ${c.certificateNumber}`}
                  >
                    {downloadingNumber === c.certificateNumber ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Download className="h-4 w-4" aria-hidden="true" />
                    )}
                  </Button>
                  {revoked ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onReinstate(c)}
                      aria-label={`Reinstate ${c.certificateNumber}`}
                      title="Reinstate (undo revocation)"
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRevoke(c)}
                      className="text-destructive"
                      aria-label={`Revoke ${c.certificateNumber}`}
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
