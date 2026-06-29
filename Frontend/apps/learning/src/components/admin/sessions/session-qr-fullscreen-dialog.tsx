"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import { useFormatter, useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@repo/ui";
import type { SessionQrCode } from "@/types";

interface SessionQrFullscreenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qr: SessionQrCode;
}

export function SessionQrFullscreenDialog({
  open,
  onOpenChange,
  qr,
}: SessionQrFullscreenDialogProps) {
  const t = useTranslations("adminSessions");
  const format = useFormatter();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, qr.payload, {
      width: 640,
      margin: 2,
      errorCorrectionLevel: "M",
    }).catch(() => undefined);
  }, [open, qr.payload]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl bg-card">
        <DialogTitle className="sr-only">
          {t("qrFullscreen.srTitle")}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {t("qrFullscreen.srDescription")}
        </DialogDescription>
        <div className="flex flex-col items-center gap-6 py-6">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-bold text-foreground">
              {t("qrFullscreen.heading")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("qrFullscreen.instruction")}
            </p>
          </div>
          <div className="rounded-2xl border border-border/40 bg-white p-6 shadow-sm">
            <canvas ref={canvasRef} aria-label={t("qrFullscreen.canvasAria")} />
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            {t("qrFullscreen.autoRotate", {
              minutes: format.number(qr.rotationSeconds / 60),
              expires: format.dateTime(new Date(qr.expiresAt), {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
