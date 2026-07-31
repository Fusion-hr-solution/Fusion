"use client";

import { useEffect, useRef } from "react";
import type { ProctoringChannel } from "@/lib/proctor/proctoring-channel";

/**
 * Layer B — browser-integrity proctoring (cheap, no camera, no model download). Attaches passive
 * listeners for tab/window focus loss, fullscreen exit, a second display, and clipboard
 * copy/cut/paste, and enqueues the resulting metadata into the shared {@link ProctoringChannel}
 * (which owns batching/heartbeat/flush).
 *
 * Clipboard scoping (must NOT break the code editor): copy/cut/paste are BLOCKED only inside a plain
 * answer field (`[data-proctor-answer]`); inside the Monaco editor (`.monaco-editor`) they are
 * logged but never blocked; the Frontend Project runs in a cross-origin iframe whose clipboard
 * events never reach this document, so it is untouched.
 *
 * Detection is a deterrent, not proof: everything here is client-side and circumventable — the
 * value is the logged signal, surfaced to a reviewer.
 */

const EVENT = {
  tabFocusLoss: "tab_focus_loss",
  fullscreenExit: "fullscreen_exit",
  secondDisplay: "second_display",
  copy: "copy",
  cut: "cut",
  paste: "paste",
} as const;

export interface UseBrowserIntegrityOptions {
  /** The attempt is in progress. When false the hook is completely inert. */
  active: boolean;
  /** EnableActivityMonitoring — tab/window focus loss, fullscreen exit, second display. */
  activityMonitoring: boolean;
  /** RestrictCopyPaste — block+log clipboard in answer fields, log-only in the code editor. */
  restrictCopyPaste: boolean;
}

/** Where a clipboard event originated, for scoping the block and enriching the log. */
function clipboardContext(target: EventTarget | null): "answer" | "code" | "other" {
  const el = target instanceof Element ? target : null;
  if (!el || typeof el.closest !== "function") {
    return "other";
  }
  if (el.closest("[data-proctor-answer]")) {
    return "answer";
  }
  if (el.closest(".monaco-editor")) {
    return "code";
  }
  return "other";
}

export function useBrowserIntegrity(
  channel: ProctoringChannel,
  { active, activityMonitoring, restrictCopyPaste }: UseBrowserIntegrityOptions
): void {
  const secondDisplaySentRef = useRef(false);

  useEffect(() => {
    if (!active || (!activityMonitoring && !restrictCopyPaste)) {
      return;
    }

    const blurStart = { current: null as string | null };
    let wasFullscreen = typeof document !== "undefined" && Boolean(document.fullscreenElement);

    const openFocusLoss = () => {
      if (!blurStart.current) {
        blurStart.current = new Date().toISOString();
      }
    };
    const closeFocusLoss = () => {
      if (blurStart.current) {
        channel.enqueue(EVENT.tabFocusLoss, {
          startedAtUtc: blurStart.current,
          endedAtUtc: new Date().toISOString(),
        });
        blurStart.current = null;
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        openFocusLoss();
        // A backgrounded tab throttles timers, so flush now — via the async POST, not a beacon, so
        // a rejection (e.g. the per-attempt rate limit) is visible and the events are re-queued.
        void channel.flushAsync(true);
      } else {
        closeFocusLoss();
      }
    };
    const onWindowBlur = () => openFocusLoss();
    const onWindowFocus = () => closeFocusLoss();

    const onFullscreenChange = () => {
      const isFs = Boolean(document.fullscreenElement);
      if (wasFullscreen && !isFs) {
        channel.enqueue(EVENT.fullscreenExit);
      }
      wasFullscreen = isFs;
    };

    const onClipboard = (e: ClipboardEvent) => {
      const context = clipboardContext(e.target);
      const type = e.type === "copy" ? EVENT.copy : e.type === "cut" ? EVENT.cut : EVENT.paste;
      const length =
        e.type === "paste"
          ? e.clipboardData?.getData("text")?.length ?? 0
          : window.getSelection()?.toString().length ?? 0;

      // Block only inside a plain answer field; never break the Monaco editor or anything else.
      if (context === "answer") {
        e.preventDefault();
      }
      channel.enqueue(type, { detail: `${context}:${length}` });
    };

    if (activityMonitoring) {
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("blur", onWindowBlur);
      window.addEventListener("focus", onWindowFocus);
      document.addEventListener("fullscreenchange", onFullscreenChange);

      // One-shot: a second display present at start is the best answer to the off-camera monitor.
      // Guarded so an effect re-run can't emit a duplicate row for the same attempt.
      const screenLike = window.screen as Screen & { isExtended?: boolean };
      if (!secondDisplaySentRef.current && screenLike?.isExtended === true) {
        secondDisplaySentRef.current = true;
        channel.enqueue(EVENT.secondDisplay);
      }
    }

    if (restrictCopyPaste) {
      // Capture phase so we see (and can block) the event before the field handles it.
      document.addEventListener("copy", onClipboard, true);
      document.addEventListener("cut", onClipboard, true);
      document.addEventListener("paste", onClipboard, true);
    }

    const onPageHide = () => {
      if (blurStart.current) {
        channel.enqueue(EVENT.tabFocusLoss, { startedAtUtc: blurStart.current });
        blurStart.current = null;
      }
      channel.flushBeacon(true);
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("copy", onClipboard, true);
      document.removeEventListener("cut", onClipboard, true);
      document.removeEventListener("paste", onClipboard, true);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [channel, active, activityMonitoring, restrictCopyPaste]);
}
