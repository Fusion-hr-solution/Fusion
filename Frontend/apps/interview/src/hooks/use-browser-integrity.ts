"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  beaconProctoringEvents,
  submitProctoringEvents,
  type ProctoringEventInput,
  type SubmitProctoringEventsInput,
} from "@/services/candidate-access-service";

/**
 * Layer B — browser-integrity proctoring (cheap, no camera, no model download).
 *
 * Attaches passive listeners for tab/window focus loss, fullscreen exit, a second display, and
 * clipboard copy/cut/paste, batches the resulting metadata (~10s) to the token-gated ingestion
 * endpoint, keeps a heartbeat, and does a best-effort `sendBeacon` flush on unload/submit.
 *
 * Clipboard scoping (must NOT break the code editor): copy/cut/paste are BLOCKED only inside a
 * plain answer field (`[data-proctor-answer]`); inside the Monaco code editor (`.monaco-editor`)
 * they are logged but never blocked; the Frontend Project runs in a cross-origin iframe whose
 * clipboard events never reach this document, so it is untouched.
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

const DEFAULT_BATCH_INTERVAL_MS = 10_000;
/** Bound the pending queue so a long offline stretch can't grow it without limit. */
const MAX_QUEUE = 300;
/**
 * Must stay <= the server's ProctoringIngestLimits.MaxBatchSize. A larger POST is rejected 400,
 * which would turn any backlog (> this many queued events) into a permanent failure loop.
 */
const MAX_BATCH = 100;

export interface UseBrowserIntegrityOptions {
  token: string;
  browserFingerprint?: string;
  /** The attempt is in progress. When false the hook is completely inert. */
  active: boolean;
  /** EnableActivityMonitoring — tab/window focus loss, fullscreen exit, second display. */
  activityMonitoring: boolean;
  /** RestrictCopyPaste — block+log clipboard in answer fields, log-only in the code editor. */
  restrictCopyPaste: boolean;
  batchIntervalMs?: number;
}

export interface BrowserIntegrityHandle {
  /** Best-effort immediate flush (used just before submit), with a sendBeacon fallback. */
  flushNow: () => Promise<void>;
}

function newClientEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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

export function useBrowserIntegrity(options: UseBrowserIntegrityOptions): BrowserIntegrityHandle {
  const {
    active,
    activityMonitoring,
    restrictCopyPaste,
    batchIntervalMs = DEFAULT_BATCH_INTERVAL_MS,
  } = options;

  // Latest token/fingerprint without re-attaching listeners when the fingerprint resolves.
  // Written in an effect, never during render (a discarded concurrent render must not mutate it).
  const optsRef = useRef(options);
  useEffect(() => {
    optsRef.current = options;
  });

  const queueRef = useRef<ProctoringEventInput[]>([]);
  const inFlightRef = useRef(false);
  const secondDisplaySentRef = useRef(false);

  const enqueue = useCallback(
    (type: string, extra?: Partial<Omit<ProctoringEventInput, "clientEventId" | "type">>) => {
      const event: ProctoringEventInput = {
        clientEventId: newClientEventId(),
        type,
        startedAtUtc: extra?.startedAtUtc ?? new Date().toISOString(),
        endedAtUtc: extra?.endedAtUtc,
        confidence: extra?.confidence,
        detail: extra?.detail,
      };
      const queue = queueRef.current;
      queue.push(event);
      if (queue.length > MAX_QUEUE) {
        queue.splice(0, queue.length - MAX_QUEUE); // drop oldest
      }
    },
    []
  );

  const takeBatch = useCallback((heartbeat: boolean): SubmitProctoringEventsInput | null => {
    const events = queueRef.current;
    if (events.length === 0 && !heartbeat) {
      return null;
    }
    // Never exceed the server's per-batch cap; a backlog drains across successive ticks instead of
    // being rejected wholesale.
    const drained = events.splice(0, Math.min(events.length, MAX_BATCH));
    return {
      browserFingerprint: optsRef.current.browserFingerprint,
      heartbeat,
      events: drained,
    };
  }, []);

  /** Returns true when the batch was delivered (or there was nothing to send). */
  const flushAsync = useCallback(
    async (heartbeat: boolean): Promise<boolean> => {
      if (inFlightRef.current) {
        return false;
      }
      const batch = takeBatch(heartbeat);
      if (!batch) {
        return true;
      }
      inFlightRef.current = true;
      try {
        await submitProctoringEvents(optsRef.current.token, batch);
        return true;
      } catch {
        // Re-queue on failure so an at-least-once retry lands next tick (client-id deduped server-side).
        queueRef.current.unshift(...batch.events);
        if (queueRef.current.length > MAX_QUEUE) {
          queueRef.current.splice(0, queueRef.current.length - MAX_QUEUE);
        }
        return false;
      } finally {
        inFlightRef.current = false;
      }
    },
    [takeBatch]
  );

  const flushBeacon = useCallback(
    (heartbeat: boolean): void => {
      const batch = takeBatch(heartbeat);
      if (!batch) {
        return;
      }
      const ok = beaconProctoringEvents(optsRef.current.token, batch);
      if (!ok) {
        // Browser refused the beacon — put the events back for the next async flush.
        queueRef.current.unshift(...batch.events);
      }
    },
    [takeBatch]
  );

  /**
   * Final delivery just before submit. Prefers the async POST — the page is still alive, so a
   * rejection (rate limit, transient network) is visible and the events are re-queued — then falls
   * back to a beacon for anything still pending. A bare beacon here could silently lose the most
   * important batch of the attempt.
   */
  const flushNow = useCallback(async (): Promise<void> => {
    await flushAsync(true);
    if (queueRef.current.length > 0) {
      flushBeacon(true);
    }
  }, [flushAsync, flushBeacon]);

  useEffect(() => {
    if (!active || (!activityMonitoring && !restrictCopyPaste)) {
      return;
    }

    // ── Layer B: browser-integrity signals (gated on activity monitoring) ──
    const blurStartRef = { current: null as string | null };
    let wasFullscreen = typeof document !== "undefined" && Boolean(document.fullscreenElement);

    const openFocusLoss = () => {
      if (!blurStartRef.current) {
        blurStartRef.current = new Date().toISOString();
      }
    };
    const closeFocusLoss = () => {
      if (blurStartRef.current) {
        enqueue(EVENT.tabFocusLoss, {
          startedAtUtc: blurStartRef.current,
          endedAtUtc: new Date().toISOString(),
        });
        blurStartRef.current = null;
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        openFocusLoss();
        // A backgrounded tab throttles timers, so flush now — but via the async POST, not a beacon.
        // The page is still alive, so a rejection (e.g. the server's per-attempt rate limit) is
        // visible and the events are re-queued, instead of being dropped by fire-and-forget.
        void flushAsync(true);
      } else {
        closeFocusLoss();
      }
    };
    const onWindowBlur = () => openFocusLoss();
    const onWindowFocus = () => closeFocusLoss();

    const onFullscreenChange = () => {
      const isFs = Boolean(document.fullscreenElement);
      if (wasFullscreen && !isFs) {
        enqueue(EVENT.fullscreenExit);
      }
      wasFullscreen = isFs;
    };

    // ── Layer B: clipboard (gated on restrict copy/paste) ──
    const onClipboard = (e: ClipboardEvent) => {
      const context = clipboardContext(e.target);
      const type =
        e.type === "copy" ? EVENT.copy : e.type === "cut" ? EVENT.cut : EVENT.paste;
      const length =
        e.type === "paste"
          ? e.clipboardData?.getData("text")?.length ?? 0
          : window.getSelection()?.toString().length ?? 0;

      // Block only inside a plain answer field; never break the Monaco editor or anything else.
      if (context === "answer") {
        e.preventDefault();
      }
      enqueue(type, { detail: `${context}:${length}` });
    };

    if (activityMonitoring) {
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("blur", onWindowBlur);
      window.addEventListener("focus", onWindowFocus);
      document.addEventListener("fullscreenchange", onFullscreenChange);

      // One-shot: a second display present at start is the best answer to the off-camera monitor.
      // Guarded by a ref so an effect re-run can't emit a duplicate row for the same attempt.
      const screenLike = window.screen as Screen & { isExtended?: boolean };
      if (!secondDisplaySentRef.current && screenLike?.isExtended === true) {
        secondDisplaySentRef.current = true;
        enqueue(EVENT.secondDisplay);
      }
    }

    if (restrictCopyPaste) {
      // Capture phase so we see (and can block) the event before the field handles it.
      document.addEventListener("copy", onClipboard, true);
      document.addEventListener("cut", onClipboard, true);
      document.addEventListener("paste", onClipboard, true);
    }

    // ── Delivery: periodic heartbeat + batch, final flush on unload ──
    const onPageHide = () => {
      if (blurStartRef.current) {
        // Tab was hidden and never came back before unload — record the open episode.
        enqueue(EVENT.tabFocusLoss, { startedAtUtc: blurStartRef.current });
        blurStartRef.current = null;
      }
      flushBeacon(true);
    };
    window.addEventListener("pagehide", onPageHide);

    const interval = window.setInterval(() => void flushAsync(true), batchIntervalMs);

    // Immediate proof-of-life (delivers any second_display captured above, off the timer).
    void flushAsync(true);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("copy", onClipboard, true);
      document.removeEventListener("cut", onClipboard, true);
      document.removeEventListener("paste", onClipboard, true);
      window.removeEventListener("pagehide", onPageHide);
      // Best-effort final delivery on teardown (navigation away / submit).
      flushBeacon(true);
    };
  }, [active, activityMonitoring, restrictCopyPaste, batchIntervalMs, enqueue, flushAsync, flushBeacon]);

  return { flushNow };
}
