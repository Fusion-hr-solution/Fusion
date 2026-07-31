"use client";

// Persistent, page-level host for the (single) Frontend Project question. It owns ONE
// cross-origin-isolated sandbox iframe that is booted ONCE — during the pre-warm step, before the
// attempt/timer starts — and kept alive for the whole session so the question opens instantly.
//
// Lifecycle:
//   1. iframe says "sandbox-ready"  → we send `prewarm` (boot the framework's default template)
//   2. iframe streams `status`      → drives the parent's progress bar; on "ready" we call onReady
//   3. once the attempt has started → parent passes `realProject`; we send `init-files` to swap the
//      candidate's real starter/saved answer into the already-warm container (near-instant)
//   4. iframe streams `change`      → persisted to answerText via onChange
//
// The iframe is always mounted (so the WebContainer never tears down). It overlays the frontend
// question's slot when that question is active (measured from `slotRef`), and sits off-screen +
// hidden otherwise — never unmounted.

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const SANDBOX_URL = "/interview/candidate/frontend-sandbox";

type Rect = { top: number; left: number; width: number; height: number };

type FrontendSessionSandboxProps = {
  framework: string;
  /** The candidate's real files (saved answer or author starter), sent once the attempt started. */
  realProject?: string;
  /** True when the frontend question is the one currently on screen. */
  visible: boolean;
  /** Placeholder element in the frontend question's slot; the iframe overlays its rect. */
  slotRef: React.RefObject<HTMLElement | null>;
  onPhase: (phase: string) => void;
  onReady: () => void;
  onChange: (value: string) => void;
};

export function FrontendSessionSandbox({
  framework,
  realProject,
  visible,
  slotRef,
  onPhase,
  onReady,
  onChange,
}: FrontendSessionSandboxProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const filesSentRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // Bridge: prewarm on ready-to-init, forward status/change up, toggle fullscreen on request.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as { type?: string; phase?: string; project?: string };

      if (data?.type === "sandbox-ready") {
        iframeRef.current?.contentWindow?.postMessage(
          { type: "prewarm", framework },
          window.location.origin,
        );
      } else if (data?.type === "status" && data.phase) {
        onPhase(data.phase);
        if (data.phase === "ready") {
          setReady(true);
          onReady();
        }
      } else if (data?.type === "change" && typeof data.project === "string") {
        onChange(data.project);
      } else if (data?.type === "toggle-fullscreen") {
        setFullscreen((f) => !f);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [framework, onPhase, onReady, onChange]);

  // Echo the fullscreen state back so the iframe's button icon stays in sync.
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: "fullscreen", value: fullscreen }, window.location.origin);
  }, [fullscreen]);

  // Leaving the question drops fullscreen; while fullscreen, Esc exits and body scroll is locked.
  useEffect(() => {
    if (!visible && fullscreen) setFullscreen(false);
  }, [visible, fullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFullscreen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [fullscreen]);

  // Swap the candidate's real files in once the container is warm AND we have them.
  useEffect(() => {
    if (!ready || !realProject || filesSentRef.current) return;
    filesSentRef.current = true;
    iframeRef.current?.contentWindow?.postMessage(
      { type: "init-files", project: realProject },
      window.location.origin,
    );
  }, [ready, realProject]);

  // Track the slot's position in DOCUMENT coordinates (viewport rect + scroll offset). Because we
  // position the overlay `absolute` at these coords, it scrolls with the page natively — so we do
  // NOT re-measure on scroll (that lagged a frame behind and made the IDE wiggle). We only re-measure
  // on layout changes: window resize, the slot resizing, or the page height changing.
  const measure = useCallback(() => {
    const el = slotRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height });
  }, [slotRef]);

  useEffect(() => {
    if (!visible) return;
    measure();
    // A second measure after paint catches late layout (fonts, images) settling.
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    const observer = new ResizeObserver(measure);
    if (slotRef.current) observer.observe(slotRef.current);
    observer.observe(document.body);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [visible, measure, slotRef]);

  // Off-screen when the question isn't active (kept rendered so the WebContainer keeps running).
  // When active: fullscreen covers everything (above the header); otherwise overlay the slot with a
  // z-index BELOW the sticky exam header (z-10) so scrolling tucks the IDE under the bar, never over it.
  const hidden = !visible;
  const parked: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    width: 1200,
    height: 800,
    visibility: "hidden",
    pointerEvents: "none",
    zIndex: -1,
  };
  const style: React.CSSProperties = hidden
    ? parked
    : fullscreen
      ? { position: "fixed", inset: 0, zIndex: 50 }
      : rect
        ? { position: "absolute", top: rect.top, left: rect.left, width: rect.width, height: rect.height, zIndex: 5 }
        : parked;

  return (
    <div
      style={style}
      className={cn(
        "overflow-hidden bg-zinc-900 shadow-lg",
        fullscreen ? "" : "rounded-xl border border-zinc-800"
      )}
    >
      <iframe ref={iframeRef} title="Frontend project sandbox" src={SANDBOX_URL} className="h-full w-full border-0" />
    </div>
  );
}
