"use client";

import { useState } from "react";
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

export function RevokeCertificateDialog({ certificate, onClose, onRevoked }: RevokeCertificateDialogProps) {
  const [reason, setReason] = useState("");

  const { mutateAsync, isLoading } = useApiMutation(
    (args: { id: string; reason: string }) => revokeCertificate(args.id, args.reason),
    {
      onSuccess: () => {
        toast.success("Certificate revoked.");
        setReason("");
        onRevoked();
        onClose();
      },
      onError: () => toast.error("Could not revoke the certificate."),
    },
  );

  function close() {
    setReason("");
    onClose();
  }

  return (
    <Dialog open={Boolean(certificate)} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke certificate</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Revoking <span className="font-mono">{certificate?.certificateNumber}</span> for{" "}
            <span className="font-medium text-foreground">{certificate?.employeeFullName}</span> is permanent.
            The public verification page will show it as Revoked.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="revoke-reason">Reason</Label>
            <Input
              id="revoke-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Issued in error"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={reason.trim().length < 3 || isLoading}
            onClick={() => certificate && mutateAsync({ id: certificate.id, reason: reason.trim() })}
          >
            Revoke
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
