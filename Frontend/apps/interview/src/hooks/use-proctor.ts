"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProctoringChannel } from "@/lib/proctor/proctoring-channel";
import type { ProctorInbound, ProctorOutbound } from "@/lib/proctor/messages";
import {
  ABSENT_SUSTAIN_MS,
  FACE_MODEL_URL,
  FRAME_INTERVAL_MS,
  LOOK_AWAY_SUSTAIN_MS,
  MEDIAPIPE_WASM_BASE,
  OBJECT_MODEL_URL,
  PITCH_THRESHOLD_DEG,
  PROHIBITED_OBJECT_COOLDOWN_MS,
  SECOND_PERSON_SUSTAIN_MS,
  YAW_THRESHOLD_DEG,
  type ProctorStatus,
} from "@/lib/proctor/constants";

/**
 * Layer A — webcam proctoring via MediaPipe (FaceLandmarker + ObjectDetector in a GPU worker).
 *
 * Privacy/consent: touches the camera ONLY once `consented` is true. Detection is entirely
 * client-side — frames never leave the worker; only small metadata events reach the server. Warm
 * (getUserMedia + model load) is meant to run on the pre-start screen, BEFORE the attempt, so the
 * download is off the timer. Strict teardown stops the tracks (camera light off) and terminates the
 * worker — driven by the lifecycle effect's cleanup, which also makes the acquire StrictMode-safe.
 *
 * Graceful degradation: a denied/absent/lost camera emits `camera_denied`/`camera_lost` and the
 * candidate proceeds — the reviewer sees the heartbeat gap. Inference pauses while `paused` (e.g.
 * the WebContainers sandbox is booting; both are GPU-heavy).
 */

// requestVideoFrameCallback isn't in every TS DOM lib yet.
type VideoWithRvfc = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

export interface UseProctorOptions {
  /** EnableProctoring (test-level). When false the hook is fully inert and never touches the camera. */
  enabled: boolean;
  /** The candidate has given recorded consent. Gates all camera access. */
  consented: boolean;
  /** The attempt is in progress — feed frames and emit events. */
  running: boolean;
  /** Pause inference (keep the camera warm) — e.g. while the sandbox boots. */
  paused: boolean;
}

export interface ProctorHandle {
  status: ProctorStatus;
  /** The live camera stream, for an optional self-view preview (nothing is uploaded). */
  stream: MediaStream | null;
}

interface Episode {
  activeSince: number | null;
  emitted: boolean;
}

function updateEpisode(
  state: Episode,
  condition: boolean,
  now: number,
  sustainMs: number,
  emit: (startedAtMs: number) => void
): void {
  if (condition) {
    if (state.activeSince === null) {
      state.activeSince = now;
    }
    if (!state.emitted && now - state.activeSince >= sustainMs) {
      emit(state.activeSince);
      state.emitted = true;
    }
  } else {
    state.activeSince = null;
    state.emitted = false;
  }
}

export function useProctor(channel: ProctoringChannel, options: UseProctorOptions): ProctorHandle {
  const { enabled, consented, running, paused } = options;

  const [status, setStatus] = useState<ProctorStatus>("idle");
  const [warmReady, setWarmReady] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const videoRef = useRef<VideoWithRvfc | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Frame-pump state. A monotonically increasing generation invalidates any in-flight tick so a
  // pause/resume (or StrictMode re-run) can never leave two loops running.
  const pumpHandleRef = useRef<number | null>(null);
  const pumpGenRef = useRef(0);
  const usingRvfcRef = useRef(false);
  const tsRef = useRef(0);
  const lastFrameRef = useRef(0);

  // Per-signal state machines (main thread).
  const secondPersonRef = useRef<Episode>({ activeSince: null, emitted: false });
  const absentRef = useRef<Episode>({ activeSince: null, emitted: false });
  const lookAwayRef = useRef<Episode>({ activeSince: null, emitted: false });
  const objectCooldownRef = useRef<Map<string, number>>(new Map());

  const stopPump = useCallback(() => {
    pumpGenRef.current += 1; // invalidate any scheduled/in-flight tick
    const handle = pumpHandleRef.current;
    if (handle !== null) {
      const video = videoRef.current;
      if (usingRvfcRef.current && video?.cancelVideoFrameCallback) {
        video.cancelVideoFrameCallback(handle);
      } else {
        clearTimeout(handle);
      }
      pumpHandleRef.current = null;
    }
  }, []);

  const startPump = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const gen = (pumpGenRef.current += 1);
    usingRvfcRef.current = typeof video.requestVideoFrameCallback === "function";

    const tick = async () => {
      if (gen !== pumpGenRef.current) {
        return; // superseded by a newer pump (or stopped)
      }
      const now = performance.now();
      const worker = workerRef.current;
      if (worker && video.readyState >= 2 && now - lastFrameRef.current >= FRAME_INTERVAL_MS) {
        lastFrameRef.current = now;
        try {
          // Downscale before inference to bound GPU cost; transfer the bitmap (zero-copy).
          const bitmap = await createImageBitmap(video, {
            resizeWidth: 320,
            resizeHeight: 240,
            resizeQuality: "low",
          });
          if (gen !== pumpGenRef.current) {
            bitmap.close(); // stopped while decoding — don't leak or post a stray frame
            return;
          }
          // Strictly increasing timestamp (MediaPipe VIDEO mode requires it).
          tsRef.current = Math.max(tsRef.current + 1, Math.round(now));
          const frame: ProctorInbound = { type: "frame", bitmap, timestampMs: tsRef.current };
          worker.postMessage(frame, [bitmap]);
        } catch {
          // Transient (frame not ready) — skip.
        }
      }
      schedule();
    };

    const schedule = () => {
      if (gen !== pumpGenRef.current) {
        return;
      }
      if (usingRvfcRef.current && video.requestVideoFrameCallback) {
        pumpHandleRef.current = video.requestVideoFrameCallback(() => void tick());
      } else {
        pumpHandleRef.current = window.setTimeout(() => void tick(), FRAME_INTERVAL_MS);
      }
    };

    schedule();
  }, []);

  const handleObservation = useCallback(
    (message: ProctorOutbound) => {
      const now = Date.now();
      if (message.type === "ready") {
        setWarmReady(true);
        setStatus((prev) => (prev === "requesting" || prev === "warming" ? "ready" : prev));
        return;
      }
      if (message.type === "init-error") {
        // Model load failed — release the camera (no point holding it) and go inert.
        setWarmReady(false);
        setStatus("error");
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setStream(null);
        return;
      }
      if (message.type === "face") {
        const { faceCount, yaw, pitch } = message;

        updateEpisode(secondPersonRef.current, faceCount >= 2, now, SECOND_PERSON_SUSTAIN_MS, (startedAtMs) =>
          channel.enqueue("second_person", { startedAtUtc: new Date(startedAtMs).toISOString() })
        );

        updateEpisode(absentRef.current, faceCount === 0, now, ABSENT_SUSTAIN_MS, (startedAtMs) =>
          channel.enqueue("candidate_absent", { startedAtUtc: new Date(startedAtMs).toISOString() })
        );

        const lookingAway =
          faceCount >= 1 &&
          yaw !== null &&
          pitch !== null &&
          (Math.abs(yaw) > YAW_THRESHOLD_DEG || Math.abs(pitch) > PITCH_THRESHOLD_DEG);
        const confidence =
          yaw !== null && pitch !== null
            ? Math.min(1, Math.max(Math.abs(yaw), Math.abs(pitch)) / 90)
            : undefined;
        updateEpisode(lookAwayRef.current, lookingAway, now, LOOK_AWAY_SUSTAIN_MS, (startedAtMs) =>
          channel.enqueue("looking_away", {
            startedAtUtc: new Date(startedAtMs).toISOString(),
            confidence,
          })
        );
        return;
      }
      if (message.type === "object") {
        for (const detection of message.detections) {
          const last = objectCooldownRef.current.get(detection.label) ?? 0;
          if (now - last >= PROHIBITED_OBJECT_COOLDOWN_MS) {
            objectCooldownRef.current.set(detection.label, now);
            channel.enqueue("prohibited_object", {
              detail: detection.label,
              confidence: detection.score,
            });
          }
        }
      }
    },
    [channel]
  );

  // ── Lifecycle: consent → camera → worker + models. Acquire here, release in cleanup, so it is
  //    StrictMode-safe (double-invoke fully tears down run 1 before run 2 acquires) and leak-free. ──
  useEffect(() => {
    if (!enabled || !consented) {
      return;
    }
    let cancelled = false;
    let acquiredStream: MediaStream | null = null;
    let createdWorker: Worker | null = null;
    let createdVideo: HTMLVideoElement | null = null;
    let endedTrack: MediaStreamTrack | null = null;
    let onTrackEnded: (() => void) | null = null;

    void (async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) {
          setStatus("unsupported");
          channel.enqueue("camera_denied", { detail: "unsupported" });
        }
        return;
      }

      setStatus("requesting");
      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: false,
        });
      } catch (err) {
        if (!cancelled) {
          setStatus("denied");
          channel.enqueue("camera_denied", { detail: err instanceof Error ? err.name : "denied" });
        }
        return;
      }

      if (cancelled) {
        mediaStream.getTracks().forEach((track) => track.stop());
        return;
      }

      acquiredStream = mediaStream;
      streamRef.current = mediaStream;
      setStream(mediaStream);

      endedTrack = mediaStream.getVideoTracks()[0] ?? null;
      onTrackEnded = () => {
        // Fires on unplug/OS revocation (NOT on our own stop()). Go inert.
        channel.enqueue("camera_lost");
        setWarmReady(false);
        setStatus("lost");
        stopPump();
      };
      endedTrack?.addEventListener("ended", onTrackEnded);

      const video = document.createElement("video") as VideoWithRvfc;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = mediaStream;
      createdVideo = video;
      videoRef.current = video;
      try {
        await video.play();
      } catch {
        // A muted, playsInline video should autoplay; ignore if the browser defers it.
      }
      if (cancelled) {
        return;
      }

      setStatus("warming");
      const worker = new Worker(new URL("../lib/proctor/proctor-worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (event: MessageEvent<ProctorOutbound>) => handleObservation(event.data);
      worker.onerror = () => {
        if (cancelled) {
          return;
        }
        setWarmReady(false);
        setStatus("error");
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setStream(null);
      };
      createdWorker = worker;
      workerRef.current = worker;
      const init: ProctorInbound = {
        type: "init",
        wasmBase: MEDIAPIPE_WASM_BASE,
        faceModelUrl: FACE_MODEL_URL,
        objectModelUrl: OBJECT_MODEL_URL,
      };
      worker.postMessage(init);
    })();

    return () => {
      cancelled = true;
      stopPump();
      if (endedTrack && onTrackEnded) {
        endedTrack.removeEventListener("ended", onTrackEnded);
      }
      if (createdWorker) {
        createdWorker.postMessage({ type: "close" } satisfies ProctorInbound);
        createdWorker.terminate();
      }
      acquiredStream?.getTracks().forEach((track) => track.stop()); // camera light off
      if (createdVideo) {
        createdVideo.srcObject = null;
      }
      if (workerRef.current === createdWorker) {
        workerRef.current = null;
      }
      if (streamRef.current === acquiredStream) {
        streamRef.current = null;
      }
      if (videoRef.current === createdVideo) {
        videoRef.current = null;
      }
    };
  }, [enabled, consented, channel, handleObservation, stopPump]);

  // ── Feed frames only while in progress, not paused, and warm. Inert once warmReady is cleared by
  //    a terminal error/lost, so it can't stomp those states or restart a dead camera. ──
  useEffect(() => {
    if (!warmReady) {
      return;
    }
    if (running && !paused) {
      startPump();
      setStatus("running");
    } else {
      stopPump();
      setStatus("ready");
    }
    return () => stopPump();
  }, [warmReady, running, paused, startPump, stopPump]);

  return { status, stream };
}
