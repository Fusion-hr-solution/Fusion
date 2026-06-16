"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CameraOff, CheckCircle2, Loader2, QrCode, ScanLine, XCircle } from "lucide-react";
import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { Button, Card, CardContent } from "@repo/ui";
import { useApiMutation } from "@repo/api/react";
import { ApiError } from "@repo/api";
import { toast } from "sonner";
import { scanQrAttendance } from "@/services/enrollment-service";
import type { ScanQrResult } from "@/types";

type ScanState =
  | { kind: "idle" }
  | { kind: "submitting"; payload: string }
  | { kind: "success"; result: ScanQrResult }
  | { kind: "error"; message: string; recoverable: boolean };

export function QrScannerView() {
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
        toast.success("Attendance confirmed", {
          description: result.trainingTitle,
        });
      } catch (err) {
        const { message, recoverable } = mapScanError(err);
        setState({ kind: "error", message, recoverable });
        toast.error("Scan failed", { description: message });
      }
    },
    [mutateAsync, state.kind],
  );

  const handleScan = useCallback(
    (codes: IDetectedBarcode[]) => {
      const value = codes[0]?.rawValue;
      if (value) submit(value);
    },
    [submit],
  );

  const handleScannerError = useCallback((err: unknown) => {
    const message = err instanceof Error ? err.message : "Camera unavailable.";
    setCameraError(message);
  }, []);

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
        <ArrowLeft className="h-4 w-4" />
        Back to My Sessions
      </Link>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Scan attendance QR</h1>
        <p className="text-sm text-muted-foreground">
          Point your camera at the QR code projected by your trainer.
        </p>
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
                  <CameraOff className="h-10 w-10 text-white/60" />
                  <p className="text-sm">{cameraError}</p>
                  <p className="text-xs text-white/60">
                    Allow camera access in your browser, then reload the page.
                  </p>
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
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="text-sm">Confirming attendance…</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
              <ScanLine className="h-3.5 w-3.5" />
              Hold steady — detection happens automatically.
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
  return (
    <Card className="border-emerald-200/60 bg-emerald-50/40">
      <CardContent className="py-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-emerald-900">Attendance recorded</p>
            <p className="text-xs text-emerald-800/80">
              {new Date(result.attendedAt).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-emerald-200/60 bg-white p-3 space-y-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Training</p>
          <p className="text-sm font-semibold text-foreground">{result.trainingTitle}</p>
          <p className="text-xs text-muted-foreground">{result.partTitle}</p>
          <p className="text-xs text-muted-foreground">
            Session on {new Date(result.sessionStartUtc).toLocaleString()}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onScanAgain} className="w-full">
          <QrCode className="mr-1.5 h-3.5 w-3.5" />
          Scan another
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
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="py-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <XCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-destructive">Could not record attendance</p>
            <p className="text-xs text-foreground/80">{message}</p>
          </div>
        </div>
        {onTryAgain && (
          <Button size="sm" variant="outline" onClick={onTryAgain} className="w-full">
            Try again
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
  const [value, setValue] = useState("");
  return (
    <details className="rounded-lg border border-border/50 bg-card">
      <summary className="cursor-pointer px-4 py-3 text-sm text-muted-foreground hover:text-foreground">
        Camera not working? Enter the code manually
      </summary>
      <div className="border-t border-border/50 p-4 space-y-3">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Attendance code"
          placeholder="v1.xxxx.xxx.xxxxx"
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button
          size="sm"
          disabled={disabled || !value.trim()}
          onClick={() => onSubmit(value.trim())}
          className="w-full"
        >
          Submit
        </Button>
      </div>
    </details>
  );
}

function mapScanError(err: unknown): { message: string; recoverable: boolean } {
  if (!(err instanceof ApiError)) {
    return { message: "Network error — please try again.", recoverable: true };
  }
  const code = err.errors[0] ?? "";
  switch (code) {
    case "Qr.Expired":
      return { message: "QR expired — ask the trainer for a fresh one.", recoverable: true };
    case "Qr.Revoked":
      return { message: "This QR code was revoked by the trainer.", recoverable: false };
    case "Qr.NotFound":
    case "Qr.Malformed":
    case "Qr.PayloadRequired":
      return { message: "Invalid QR code — make sure you scanned the right one.", recoverable: true };
    case "Enrollment.NotEnrolled":
      return { message: "You are not enrolled in this session.", recoverable: false };
    case "Enrollment.Waitlisted":
      return { message: "You are still on the waitlist for this session.", recoverable: false };
    case "Enrollment.AlreadyAttended":
      return { message: "Attendance has already been recorded.", recoverable: false };
    default:
      return { message: err.errors.join(". ") || "Could not record attendance.", recoverable: true };
  }
}
