"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
} from "@repo/ui";
import { useTranslations } from "next-intl";
import { useApiMutation } from "@repo/api/react";
import { cancelSession } from "@/services/admin-sessions-service";

interface CancelSessionDialogProps {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled: () => void;
}

export function CancelSessionDialog({
  sessionId,
  open,
  onOpenChange,
  onCancelled,
}: CancelSessionDialogProps) {
  const t = useTranslations("adminSessions");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { mutateAsync, isLoading } = useApiMutation(
    () => cancelSession(sessionId, { reason }),
    {
      onSuccess: () => {
        onCancelled();
        onOpenChange(false);
        setReason("");
      },
    }
  );

  async function handleConfirm() {
    setError(null);
    if (!reason.trim()) {
      setError(t("cancelDialog.reasonRequired"));
      return;
    }
    try {
      await mutateAsync();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("cancelDialog.failed"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t("cancelDialog.title")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
            <p className="text-sm text-foreground">
              {t("cancelDialog.warning")}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cancelReason" className="text-sm font-medium">
              {t("cancelDialog.reasonLabel")}
            </Label>
            <Input
              id="cancelReason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError(null);
              }}
              maxLength={1000}
              placeholder={t("cancelDialog.reasonPlaceholder")}
              className="h-10"
            />
            <p className="text-xs text-muted-foreground">
              {t("cancelDialog.reasonHint")}
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {t("cancelDialog.keepSession")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading
              ? t("cancelDialog.cancelling")
              : t("cancelDialog.confirmCancellation")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
