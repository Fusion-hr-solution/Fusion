"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@repo/ui";
import { useApiMutation } from "@repo/api/react";
import { toast } from "sonner";
import { revokeCertificate } from "@/services/admin-certificate-service";
import type { AdminCertificate } from "@/types";

interface RevokeCertificateDialogProps {
  certificate: AdminCertificate | null;
  onClose: () => void;
  onRevoked: () => void;
}

export function RevokeCertificateDialog({
  certificate,
  onClose,
  onRevoked,
}: RevokeCertificateDialogProps) {
  const t = useTranslations("adminCertificates");
  const tCommon = useTranslations("common");
  const [reason, setReason] = useState("");

  const { mutateAsync, isLoading } = useApiMutation(
    (args: { id: string; reason: string }) =>
      revokeCertificate(args.id, args.reason),
    {
      onSuccess: () => {
        toast.success(t("toast.revoked"));
        setReason("");
        onRevoked();
        onClose();
      },
      onError: () => toast.error(t("toast.revokeError")),
    }
  );

  function close() {
    setReason("");
    onClose();
  }

  return (
    <Dialog
      open={Boolean(certificate)}
      onOpenChange={(open) => !open && close()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("revokeDialog.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t.rich("revokeDialog.description", {
              number: certificate?.certificateNumber ?? "",
              name: certificate?.employeeFullName ?? "",
              mono: (chunks) => <span className="font-mono">{chunks}</span>,
              strong: (chunks) => (
                <span className="font-medium text-foreground">{chunks}</span>
              ),
            })}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="revoke-reason">
              {t("revokeDialog.reasonLabel")}
            </Label>
            <Input
              id="revoke-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("revokeDialog.reasonPlaceholder")}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {tCommon("actions.cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={reason.trim().length < 3 || isLoading}
            onClick={() =>
              certificate &&
              mutateAsync({ id: certificate.id, reason: reason.trim() })
            }
          >
            {t("revokeDialog.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
