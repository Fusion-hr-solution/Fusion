"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  QrCode,
  RefreshCw,
  Maximize2,
  Download,
  Trash2,
  Loader2,
  ShieldOff,
} from "lucide-react";
import QRCode from "qrcode";
import { Badge, Button, Card, CardContent, Separator } from "@repo/ui";
import { useFormatter, useTranslations } from "next-intl";
import { useApiMutation, useApiQuery } from "@repo/api/react";
import { ApiError } from "@repo/api";
import { toast } from "sonner";
import {
  generateSessionQrCode,
  getSessionQrCode,
  revokeSessionQrCode,
} from "@/services/admin-sessions-service";
import type { SessionQrCode } from "@/types";
import { SessionQrFullscreenDialog } from "./session-qr-fullscreen-dialog";

interface SessionQrCardProps {
  sessionId: string;
  sessionEnded: boolean;
  sessionCancelled: boolean;
}

export function SessionQrCard({
  sessionId,
  sessionEnded,
  sessionCancelled,
}: SessionQrCardProps) {
  const t = useTranslations("adminSessions");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const fetcher = useCallback(() => getSessionQrCode(sessionId), [sessionId]);
  const {
    data: qr,
    isLoading,
    error,
    refetch,
  } = useApiQuery<SessionQrCode | null>(fetcher);

  const { mutateAsync: doGenerate, isLoading: generating } = useApiMutation<
    SessionQrCode,
    boolean
  >((regenerate) => generateSessionQrCode(sessionId, regenerate), {
    onSuccess: () => {
      refetch();
      toast.success(t("qrCard.ready"));
    },
    onError: (err) => {
      const message =
        err instanceof ApiError
          ? err.errors.join(". ")
          : t("qrCard.generateFallback");
      toast.error(t("qrCard.generationFailed"), { description: message });
    },
  });

  const { mutateAsync: doRevoke, isLoading: revoking } = useApiMutation<
    void,
    void
  >(() => revokeSessionQrCode(sessionId), {
    onSuccess: () => {
      refetch();
      toast.success(t("qrCard.revoked"));
    },
    onError: (err) => {
      const message =
        err instanceof ApiError
          ? err.errors.join(". ")
          : t("qrCard.revokeFallback");
      toast.error(t("qrCard.revokeFailed"), { description: message });
    },
  });

  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  // Auto-refresh QR payload when the rotation window expires.
  useEffect(() => {
    if (!qr || qr.isRevoked) return;
    const refreshAt = new Date(qr.refreshAt).getTime();
    const delay = Math.max(1000, refreshAt - Date.now());
    const id = setTimeout(() => refetch(), delay);
    return () => clearTimeout(id);
  }, [qr, refetch]);

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-5 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error && !(error instanceof ApiError && error.status === 404)) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="py-5 space-y-2">
          <p className="text-sm text-destructive">{t("qrCard.loadError")}</p>
          <Button size="sm" variant="outline" onClick={refetch}>
            {tCommon("actions.retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const blocked = sessionCancelled || sessionEnded;

  if (!qr) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-5 space-y-3">
          <div className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              {t("qrCard.title")}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("qrCard.description")}
          </p>
          <Button
            size="sm"
            className="w-full ey-bg-dark hover:opacity-90"
            disabled={blocked || generating}
            onClick={() => doGenerate(false)}
          >
            {generating ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <QrCode className="mr-1.5 h-3.5 w-3.5" />
            )}
            {t("qrCard.generate")}
          </Button>
          {blocked && (
            <p className="text-xs text-muted-foreground">
              {sessionCancelled
                ? t("qrCard.blockedCancelled")
                : t("qrCard.blockedEnded")}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/50">
        <CardContent className="py-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">
                {t("qrCard.title")}
              </h3>
            </div>
            {qr.isRevoked ? (
              <Badge
                variant="outline"
                className="border-destructive/40 bg-destructive/10 text-destructive text-[10px]"
              >
                <ShieldOff className="mr-1 h-3 w-3" />{" "}
                {t("qrCard.revokedBadge")}
              </Badge>
            ) : (
              <RotationBadge refreshAt={qr.refreshAt} />
            )}
          </div>

          <QrPreview
            payload={qr.payload}
            disabled={qr.isRevoked}
            ariaLabel={t("qrCard.previewAria")}
          />

          <Separator />

          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={qr.isRevoked}
              onClick={() => setFullscreenOpen(true)}
            >
              <Maximize2 className="mr-1.5 h-3.5 w-3.5" />
              {t("qrCard.project")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={qr.isRevoked}
              onClick={() =>
                downloadQr(qr.payload, sessionId, t("qrCard.downloadError"))
              }
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {tCommon("actions.download")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={blocked || generating}
              onClick={() => doGenerate(true)}
            >
              {generating ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              {t("qrCard.regenerate")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={qr.isRevoked || revoking}
              onClick={() => doRevoke()}
              className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            >
              {revoking ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              {t("qrCard.revoke")}
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            {t("qrCard.issuedExpires", {
              issued: format.dateTime(new Date(qr.issuedAt), {
                hour: "2-digit",
                minute: "2-digit",
              }),
              expires: format.dateTime(new Date(qr.expiresAt), {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })}
          </p>
        </CardContent>
      </Card>

      <SessionQrFullscreenDialog
        open={fullscreenOpen}
        onOpenChange={setFullscreenOpen}
        qr={qr}
      />
    </>
  );
}

function RotationBadge({ refreshAt }: { refreshAt: string }) {
  const t = useTranslations("adminSessions");
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.round((new Date(refreshAt).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    const target = new Date(refreshAt).getTime();
    const tick = () =>
      setSecondsLeft(Math.max(0, Math.round((target - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [refreshAt]);

  return (
    <Badge
      variant="outline"
      className="text-[10px] border-border bg-muted/40 text-muted-foreground tabular-nums"
    >
      {t("qrCard.rotatesIn", { time: formatCountdown(secondsLeft) })}
    </Badge>
  );
}

function QrPreview({
  payload,
  disabled,
  ariaLabel,
}: {
  payload: string;
  disabled: boolean;
  ariaLabel: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, payload, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: "M",
    }).catch(() => {
      /* swallow render errors — UI shows placeholder */
    });
  }, [payload]);

  return (
    <div
      className={`flex items-center justify-center rounded-xl border border-border/40 bg-white p-3 ${disabled ? "opacity-30" : ""}`}
    >
      <canvas ref={canvasRef} aria-label={ariaLabel} />
    </div>
  );
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function downloadQr(
  payload: string,
  sessionId: string,
  errorMessage: string
): Promise<void> {
  try {
    const dataUrl = await QRCode.toDataURL(payload, { width: 1024, margin: 2 });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `attendance-qr-${sessionId}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {
    toast.error(errorMessage);
  }
}
