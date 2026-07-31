"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProctoringChannel } from "@/lib/proctor/proctoring-channel";
import {
  detectFace,
  detectObjects,
  loadVisionTasks,
  type VisionTasks,
} from "@/lib/proctor/vision";
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
 * Layer A — webcam proctoring via MediaPipe (FaceLandmarker + ObjectDetector), run on the MAIN
 * THREAD (a module worker under Next.js dev + basePath + COEP fails opaquely). The GPU delegate still
 * keeps the heavy compute off the CPU, and at ~1–2 fps the per-frame main-thread cost is small.
 *
 * Privacy/consent: touches the camera ONLY once `consented` is true. Detection is entirely
 * client-side — frames never leave the page; only small metadata events reach the server. Warm
 * (getUserMedia + model load) is meant to run on the pre-start screen, BEFORE the attempt, so the
 * download is off the timer. Strict teardown stops the tracks (camera light off) and closes the
 * models — driven by the lifecycle effect's cleanup, which also makes the acquire StrictMode-safe.
 *
 * Graceful degradation: a denied/absent/lost camera emits `camera_denied`/`camera_lost` and the
 * candidate proceeds. Inference pauses while `paused` (e.g. the WebContainers sandbox is booting).
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

  const tasksRef = useRef<VisionTasks | null>(null);
  const videoRef = useRef<VideoWithRvfc | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // A camera failure can happen during pre-start warm, before the attempt is running. Emitting it
  // then would stamp startedAtUtc before attempt.StartedAtUtc, so once the channel flushes (after
  // start) the backend rejects it as outside the attempt window and the channel retries forever.
  // So: emit immediately if the attempt is already running, else buffer and emit at attempt start.
  const runningRef = useRef(running);
  const pendingCameraStatusRef = useRef<{ type: string; detail?: string } | null>(null);

  // Frame-pump state. A monotonically increasing generation invalidates any in-flight tick so a
  // pause/resume (or StrictMode re-run) can never leave two loops running.
  const pumpHandleRef = useRef<number | null>(null);
  const pumpGenRef = useRef(0);
  const usingRvfcRef = useRef(false);
  const lastFrameRef = useRef(0);
  const frameCounterRef = useRef(0);

  // Per-signal state machines.
  const secondPersonRef = useRef<Episode>({ activeSince: null, emitted: false });
  const absentRef = useRef<Episode>({ activeSince: null, emitted: false });
  const lookAwayRef = useRef<Episode>({ activeSince: null, emitted: false });
  const objectCooldownRef = useRef<Map<string, number>>(new Map());

  // Emit a camera-status event with a timestamp the backend will accept: now if the attempt is
  // running, otherwise buffer it (only the latest matters) to emit once the attempt starts.
  const reportCameraStatus = useCallback(
    (type: string, detail?: string) => {
      if (runningRef.current) {
        channel.enqueue(type, detail ? { detail } : undefined);
      } else {
        pendingCameraStatusRef.current = { type, detail };
      }
    },
    [channel]
  );

  // Keep runningRef in sync, and flush any buffered camera-status event at attempt start.
  useEffect(() => {
    runningRef.current = running;
    if (running && pendingCameraStatusRef.current) {
      const pending = pendingCameraStatusRef.current;
      pendingCameraStatusRef.current = null;
      channel.enqueue(pending.type, pending.detail ? { detail: pending.detail } : undefined);
    }
  }, [running, channel]);

  const processFace = useCallback(
    (faceCount: number, yaw: number | null, pitch: number | null) => {
      const now = Date.now();

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
        channel.enqueue("looking_away", { startedAtUtc: new Date(startedAtMs).toISOString(), confidence })
      );
    },
    [channel]
  );

  const processObjects = useCallback(
    (detections: { label: string; score: number }[]) => {
      const now = Date.now();
      for (const detection of detections) {
        const last = objectCooldownRef.current.get(detection.label) ?? 0;
        if (now - last >= PROHIBITED_OBJECT_COOLDOWN_MS) {
          objectCooldownRef.current.set(detection.label, now);
          channel.enqueue("prohibited_object", { detail: detection.label, confidence: detection.score });
        }
      }
    },
    [channel]
  );

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
    // Stop decoding frames while we're not inferring (pre-start, or while the sandbox boots) so the
    // camera doesn't compete with WebContainers for CPU. The track stays live (light on, instant
    // resume) — only the <video> element pauses.
    videoRef.current?.pause();
  }, []);

  const startPump = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    void video.play().catch(() => {}); // resume decoding for inference
    const gen = (pumpGenRef.current += 1);
    usingRvfcRef.current = typeof video.requestVideoFrameCallback === "function";

    const tick = async () => {
      if (gen !== pumpGenRef.current) {
        return; // superseded by a newer pump (or stopped)
      }
      const now = performance.now();
      const tasks = tasksRef.current;
      if (tasks && video.readyState >= 2 && video.videoWidth > 0 && now - lastFrameRef.current >= FRAME_INTERVAL_MS) {
        lastFrameRef.current = now;
        try {
          // Snapshot the DECODED frame (works on a detached <video>, unlike a 2D-canvas drawImage),
          // then run one detector on that static bitmap — never the shared video element.
          const bitmap = await createImageBitmap(video);
          if (gen !== pumpGenRef.current) {
            bitmap.close();
          } else {
            // Alternate models per frame so each runs at ~half the rate, bounding cost.
            if (frameCounterRef.current % 2 === 0) {
              const face = detectFace(tasks.face, bitmap);
              processFace(face.faceCount, face.yaw, face.pitch);
            } else {
              processObjects(detectObjects(tasks.object, bitmap));
            }
            frameCounterRef.current += 1;
            bitmap.close();
          }
        } catch {
          // Transient inference hiccup — skip this frame.
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
  }, [processFace, processObjects]);

  const releaseCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  // ── Lifecycle: consent → camera → load models. Acquire here, release in cleanup, so it is
  //    StrictMode-safe (double-invoke fully tears down run 1 before run 2 acquires) and leak-free. ──
  useEffect(() => {
    if (!enabled || !consented) {
      return;
    }
    let cancelled = false;
    let acquiredStream: MediaStream | null = null;
    let createdTasks: VisionTasks | null = null;
    let createdVideo: HTMLVideoElement | null = null;
    let endedTrack: MediaStreamTrack | null = null;
    let onTrackEnded: (() => void) | null = null;

    void (async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) {
          setStatus("unsupported");
          reportCameraStatus("camera_denied", "unsupported");
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
          reportCameraStatus("camera_denied", err instanceof Error ? err.name : "denied");
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
        reportCameraStatus("camera_lost");
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
      try {
        const tasks = await loadVisionTasks(MEDIAPIPE_WASM_BASE, FACE_MODEL_URL, OBJECT_MODEL_URL);
        if (cancelled) {
          tasks.close();
          return;
        }
        createdTasks = tasks;
        tasksRef.current = tasks;
        setWarmReady(true);
        setStatus((prev) => (prev === "running" ? prev : "ready"));
      } catch (err) {
        if (cancelled) {
          return;
        }
        // Now a REAL error on the main thread (not a COEP-sanitized worker blank).
        console.error("[useProctor] failed to load proctoring models:", err);
        setStatus("error");
        releaseCamera();
      }
    })();

    return () => {
      cancelled = true;
      stopPump();
      if (endedTrack && onTrackEnded) {
        endedTrack.removeEventListener("ended", onTrackEnded);
      }
      createdTasks?.close();
      acquiredStream?.getTracks().forEach((track) => track.stop()); // camera light off
      if (createdVideo) {
        createdVideo.srcObject = null;
      }
      if (tasksRef.current === createdTasks) {
        tasksRef.current = null;
      }
      if (streamRef.current === acquiredStream) {
        streamRef.current = null;
      }
      if (videoRef.current === createdVideo) {
        videoRef.current = null;
      }
    };
  }, [enabled, consented, channel, stopPump, releaseCamera, reportCameraStatus]);

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
