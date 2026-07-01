"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CameraOff, CheckCircle2, Loader2, QrCode, ScanLine, XCircle } from "lucide-react";
import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { Button, Card, CardContent } from "@repo/ui";
import { useApiMutation } from "@repo/api/react";
import { ApiError } from "@repo/api";
import { toast } from "sonner";
import { useFormatter, useTranslations } from "next-intl";
import { scanQrAttendance } from "@/services/enrollment-service";
import type { ScanQrResult } from "@/types";

type ScanState =
  | { kind: "idle" }
  | { kind: "submitting"; payload: string }
  | { kind: "success"; result: ScanQrResult }
  | { kind: "error"; message: string; recoverable: boolean };

export function QrScannerView() {
  const t = useTranslations("mySessions");
  const [state, setState] = useState<ScanState>({ kind: "idle" });
  const [cameraError, setCameraError] = useState<string | null>(null);

  const { mutateAsync } = useApiMutation<ScanQrResult, string>(
    (payload) => scanQrAttendance(payload),
  );

  const submit = useCallback(
    async (payload: string) => {
      if (!payload || state.kind === "submitting") return;
      setState({ kind: "submitting", payload });
      try {
        const result = await mutateAsync(payload);
        setState({ kind: "success", result });
        toast.success(t("scanner.successToast"), {
          description: result.trainingTitle,
        });
      } catch (err) {
        const { key, recoverable, raw } = mapScanError(err);
        const message = raw ?? t(`scanner.errors.${key}`);
        setState({ kind: "error", message, recoverable });
        toast.error(t("scanner.errorToast"), { description: message });
      }
    },
    [mutateAsync, state.kind, t],
  );

  const handleScan = useCallback(
    (codes: IDetectedBarcode[]) => {
      const value = codes[0]?.rawValue;
      if (value) submit(value);
    },
    [submit],
  );

  const handleScannerError = useCallback(
    (err: unknown) => {
      const message =
        err instanceof Error ? err.message : t("scanner.cameraUnavailable");
      setCameraError(message);
    },
    [t],
  );

  const reset = useCallback(() => {
    setState({ kind: "idle" });
    setCameraError(null);
  }, []);

  return (
    <div className="space-y-6 p-6 max-w-2xl mx-auto">
      <Link
        href="/my-sessions"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("backToMySessions")}
      </Link>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">{t("scanner.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("scanner.subtitle")}</p>
      </div>

      {state.kind === "success" ? (
        <ScanSuccessCard result={state.result} onScanAgain={reset} />
      ) : state.kind === "error" ? (
        <ScanErrorCard message={state.message} onTryAgain={state.recoverable ? reset : null} />
      ) : (
        <Card className="overflow-hidden border-border/50">
          <CardContent className="p-0">
            <div className="relative aspect-square w-full bg-black">
              {cameraError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
                  <CameraOff className="h-10 w-10 text-white/60" aria-hidden="true" />
                  <p className="text-sm">{cameraError}</p>
                  <p className="text-xs text-white/60">{t("scanner.cameraHelp")}</p>
                </div>
              ) : (
                <Scanner
                  onScan={handleScan}
                  onError={handleScannerError}
                  constraints={{ facingMode: "environment" }}
                  paused={state.kind === "submitting"}
                  scanDelay={500}
                  formats={["qr_code"]}
                  classNames={{ container: "h-full w-full", video: "h-full w-full object-cover" }}
                />
              )}
              {state.kind === "submitting" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <div className="flex flex-col items-center gap-2 text-white">
                    <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
                    <p className="text-sm">{t("scanner.confirming")}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
              <ScanLine className="h-3.5 w-3.5" aria-hidden="true" />
              {t("scanner.holdSteady")}
            </div>
          </CardContent>
        </Card>
      )}

      <ManualEntry disabled={state.kind === "submitting"} onSubmit={submit} />
    </div>
  );
}

function ScanSuccessCard({
  result,
  onScanAgain,
}: {
  result: ScanQrResult;
  onScanAgain: () => void;
}) {
  const t = useTranslations("mySessions");
  const format = useFormatter();
  return (
    <Card className="border-[hsl(var(--ey-green-500))]/20 bg-[hsl(var(--ey-green-500))]/10">
      <CardContent className="py-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--ey-green-500))]/10 text-[hsl(var(--ey-green-500))]">
            <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-[hsl(var(--ey-green-500))]">{t("scanner.success.recorded")}</p>
            <p className="text-xs text-[hsl(var(--ey-green-500))]">
              {format.dateTime(new Date(result.attendedAt), {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-[hsl(var(--ey-green-500))]/20 bg-card p-3 space-y-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("scanner.success.trainingLabel")}
          </p>
          <p className="text-sm font-semibold text-foreground">{result.trainingTitle}</p>
          <p className="text-xs text-muted-foreground">{result.partTitle}</p>
          <p className="text-xs text-muted-foreground">
            {t("scanner.success.sessionOn", {
              date: format.dateTime(new Date(result.sessionStartUtc), {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onScanAgain} className="w-full">
          <QrCode className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t("scanner.success.scanAgain")}
        </Button>
      </CardContent>
    </Card>
  );
}

function ScanErrorCard({
  message,
  onTryAgain,
}: {
  message: string;
  onTryAgain: (() => void) | null;
}) {
  const t = useTranslations("mySessions");
  const tCommon = useTranslations("common");
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="py-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <XCircle className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-destructive">{t("scanner.errorTitle")}</p>
            <p className="text-xs text-foreground/80">{message}</p>
          </div>
        </div>
        {onTryAgain && (
          <Button size="sm" variant="outline" onClick={onTryAgain} className="w-full">
            {tCommon("actions.retry")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function ManualEntry({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (payload: string) => void;
}) {
  const t = useTranslations("mySessions");
  const [value, setValue] = useState("");
  return (
    <details className="rounded-lg border border-border/50 bg-card">
      <summary className="cursor-pointer px-4 py-3 text-sm text-muted-foreground hover:text-foreground">
        {t("scanner.manual.summary")}
      </summary>
      <div className="border-t border-border/50 p-4 space-y-3">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="v1.xxxx.xxx.xxxxx"
          rows={3}
          aria-label={t("scanner.manual.summary")}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button
          size="sm"
          disabled={disabled || !value.trim()}
          onClick={() => onSubmit(value.trim())}
          className="w-full"
        >
          {t("scanner.manual.submit")}
        </Button>
      </div>
    </details>
  );
}

type ScanErrorKey =
  | "network"
  | "qrExpired"
  | "qrRevoked"
  | "qrInvalid"
  | "notEnrolled"
  | "waitlisted"
  | "alreadyAttended"
  | "fallback";

function mapScanError(err: unknown): {
  key: ScanErrorKey;
  recoverable: boolean;
  raw?: string;
} {
  if (!(err instanceof ApiError)) {
    return { key: "network", recoverable: true };
  }
  const code = err.errors[0] ?? "";
  switch (code) {
    case "Qr.Expired":
      return { key: "qrExpired", recoverable: true };
    case "Qr.Revoked":
      return { key: "qrRevoked", recoverable: false };
    case "Qr.NotFound":
    case "Qr.Malformed":
    case "Qr.PayloadRequired":
      return { key: "qrInvalid", recoverable: true };
    case "Enrollment.NotEnrolled":
      return { key: "notEnrolled", recoverable: false };
    case "Enrollment.Waitlisted":
      return { key: "waitlisted", recoverable: false };
    case "Enrollment.AlreadyAttended":
      return { key: "alreadyAttended", recoverable: false };
    default: {
      const raw = err.errors.join(". ");
      return { key: "fallback", recoverable: true, raw: raw || undefined };
    }
  }
}
