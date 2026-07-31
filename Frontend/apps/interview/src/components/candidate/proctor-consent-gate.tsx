"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, Video } from "lucide-react";
import type { ProctorStatus } from "@/lib/proctor/constants";

/**
 * Consent + status surface for Layer A (webcam) proctoring, shown on the pre-start screen. The
 * camera is only touched AFTER the candidate clicks consent (see useProctor). Warm happens here,
 * before the attempt, so the model download is off the timer. Transparency: the candidate sees a
 * live self-view and is told nothing is recorded/uploaded.
 */

function CameraPreview({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (video && stream) {
      video.srcObject = stream;
      void video.play().catch(() => {});
    }
    return () => {
      if (video) {
        video.srcObject = null;
      }
    };
  }, [stream]);

  return (
    <video
      ref={ref}
      muted
      playsInline
      // Mirror the preview so it reads like a mirror; nothing is uploaded.
      className="h-32 w-full scale-x-[-1] rounded-xl border border-zinc-200 bg-zinc-900 object-cover"
    />
  );
}

function StatusLine({ status }: { status: ProctorStatus }) {
  const map: Record<ProctorStatus, { icon: React.ReactNode; text: string; className: string }> = {
    idle: { icon: <Loader2 className="h-4 w-4 animate-spin" />, text: "Preparing…", className: "text-zinc-500" },
    requesting: {
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      text: "Requesting camera access…",
      className: "text-zinc-600",
    },
    warming: {
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      text: "Loading proctoring models…",
      className: "text-zinc-600",
    },
    ready: { icon: <CheckCircle2 className="h-4 w-4" />, text: "Camera ready", className: "text-emerald-600" },
    running: { icon: <CheckCircle2 className="h-4 w-4" />, text: "Camera active", className: "text-emerald-600" },
    denied: {
      icon: <AlertTriangle className="h-4 w-4" />,
      text: "Camera blocked — you can still continue; this will be noted.",
      className: "text-amber-600",
    },
    unsupported: {
      icon: <AlertTriangle className="h-4 w-4" />,
      text: "This browser can't run the camera checks — you can continue.",
      className: "text-amber-600",
    },
    error: {
      icon: <AlertTriangle className="h-4 w-4" />,
      text: "Camera unavailable — you can continue; this will be noted.",
      className: "text-amber-600",
    },
    lost: {
      icon: <AlertTriangle className="h-4 w-4" />,
      text: "Camera disconnected — this will be noted.",
      className: "text-amber-600",
    },
  };
  const item = map[status];
  return (
    <p className={`flex items-center justify-center gap-1.5 text-[12px] font-medium ${item.className}`}>
      {item.icon}
      {item.text}
    </p>
  );
}

export function ProctorConsentGate({
  status,
  stream,
  consented,
  deferred = false,
  onConsent,
}: {
  status: ProctorStatus;
  stream: MediaStream | null;
  consented: boolean;
  /** Camera warm is deferred to attempt start (Frontend Project tests) — don't show a live preview yet. */
  deferred?: boolean;
  onConsent: () => void;
}) {
  if (!consented) {
    return (
      <div className="mt-7 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 text-left">
        <div className="flex items-center gap-2">
          <Video className="h-[18px] w-[18px] text-zinc-700" />
          <p className="text-[14px] font-semibold text-zinc-900">This assessment uses webcam monitoring</p>
        </div>
        <ul className="mt-3 space-y-1.5 text-[12px] leading-relaxed text-zinc-600">
          <li className="flex gap-2">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
            Detection runs entirely in your browser — <strong>no video or images are recorded or uploaded</strong>.
          </li>
          <li className="flex gap-2">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
            Only integrity flags (e.g. a second person, or leaving the frame) are shared with the reviewer.
          </li>
          <li className="flex gap-2">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
            The camera turns off the moment you submit or close the tab.
          </li>
        </ul>
        <button
          type="button"
          onClick={onConsent}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-zinc-800"
        >
          <Video className="h-4 w-4" />
          I consent and enable my camera
        </button>
      </div>
    );
  }

  // Frontend Project tests defer the camera warm to attempt start (so it doesn't starve the sandbox
  // boot), so there's no live stream to preview here yet — reassure the candidate instead.
  if (deferred && (status === "idle" || status === "requesting")) {
    return (
      <div className="mt-7 flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-[12px] font-medium text-emerald-700">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        Consent recorded. Your camera will turn on automatically when the assessment begins.
      </div>
    );
  }

  return (
    <div className="mt-7 rounded-2xl border border-zinc-200 bg-white p-4">
      <CameraPreview stream={stream} />
      <div className="mt-3">
        <StatusLine status={status} />
      </div>
    </div>
  );
}
