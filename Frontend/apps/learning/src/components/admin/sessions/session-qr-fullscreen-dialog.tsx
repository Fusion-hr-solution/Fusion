"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@repo/ui";
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
      <DialogContent className="max-w-[95vw] sm:max-w-3xl bg-white">
        <DialogTitle className="sr-only">Attendance QR code</DialogTitle>
        <DialogDescription className="sr-only">
          Scan this QR code with the Learning app to confirm your attendance.
        </DialogDescription>
        <div className="flex flex-col items-center gap-6 py-6">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-bold text-foreground">Scan to confirm attendance</h2>
            <p className="text-sm text-muted-foreground">
              Open Learning → My Sessions → Scan QR.
            </p>
          </div>
          <div className="rounded-2xl border border-border/40 bg-white p-6 shadow-sm">
            <canvas ref={canvasRef} aria-label="Attendance QR code (large)" />
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            Auto-rotates every {qr.rotationSeconds / 60} min · session expires{" "}
            {new Date(qr.expiresAt).toLocaleString()}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
