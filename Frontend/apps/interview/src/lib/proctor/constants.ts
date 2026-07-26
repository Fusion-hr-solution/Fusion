// Self-hosted MediaPipe asset URLs. The "/interview" basePath is hardcoded to match the existing
// Monaco convention (see code-runner.tsx `loader.config`). Assets are produced by
// scripts/copy-mediapipe.mjs and served same-origin (required under the exam page's COEP).
export const MEDIAPIPE_WASM_BASE = "/interview/mediapipe/wasm";
export const FACE_MODEL_URL = "/interview/mediapipe/models/face_landmarker.task";
export const OBJECT_MODEL_URL = "/interview/mediapipe/models/efficientdet_lite0.tflite";

// Frame cadence + signal thresholds. Deliberately conservative to limit false positives; the
// look-away thresholds especially should become author-configurable (see plan) rather than fixed.
export const FRAME_INTERVAL_MS = 500; // ~2 fps (alternating models → ~1 fps each)
export const SECOND_PERSON_SUSTAIN_MS = 1_500;
export const ABSENT_SUSTAIN_MS = 4_000;
export const LOOK_AWAY_SUSTAIN_MS = 2_500;
export const YAW_THRESHOLD_DEG = 25;
export const PITCH_THRESHOLD_DEG = 20;
export const PROHIBITED_OBJECT_COOLDOWN_MS = 15_000;

export type ProctorStatus =
  | "idle"
  | "requesting"
  | "warming"
  | "ready"
  | "running"
  | "denied"
  | "lost"
  | "error"
  | "unsupported";
