// MediaPipe FaceLandmarker + ObjectDetector, run on the MAIN THREAD (a module worker via
// `new URL(..., import.meta.url)` under Next.js dev + basePath + cross-origin isolation is unreliable
// and fails opaquely). useProctor's frame pump hands each detector a per-frame `createImageBitmap`
// SNAPSHOT — never the shared <video> element (two tasks fighting over one <video> broke both, and a
// 2D-canvas drawImage of a detached video is blank). No frame data leaves the page; only derived
// metadata is emitted by the hook.

import type { FaceLandmarker, ObjectDetector } from "@mediapipe/tasks-vision";

// COCO labels the ObjectDetector should flag. Kept small + high-signal.
const PROHIBITED = new Set(["cell phone", "book", "laptop"]);
const OBJECT_SCORE_THRESHOLD = 0.4;

// Set true to log every object the detector sees (label + score) when tuning the threshold/labels.
const DEBUG_OBJECTS = false;

export interface VisionTasks {
  face: FaceLandmarker;
  object: ObjectDetector;
  close: () => void;
}

export interface FaceObservation {
  faceCount: number;
  /** Head yaw/pitch (degrees) for the primary face, or null when no usable pose. */
  yaw: number | null;
  pitch: number | null;
}

export interface ObjectObservation {
  label: string;
  score: number;
}

/** Create a task on the GPU delegate, falling back to CPU (GPU/WebGL2 isn't available everywhere). */
async function createWithFallback<T>(
  label: string,
  create: (delegate: "GPU" | "CPU") => Promise<T>
): Promise<T> {
  try {
    return await create("GPU");
  } catch (gpuErr) {
    console.warn(`[proctor] ${label} GPU delegate failed, retrying on CPU:`, gpuErr);
    return await create("CPU");
  }
}

// MediaPipe/TFLite route informational stderr lines (e.g. "INFO: Created TensorFlow Lite XNNPACK
// delegate for CPU.") through console.error via Emscripten, which trips the Next.js dev error
// overlay on a message that isn't an error. Downgrade ONLY these "INFO:"-prefixed wasm lines to
// console.info; real MediaPipe errors ("ERROR:", thrown exceptions) are untouched. Installed once,
// before the wasm instantiates, so Emscripten captures the patched reference.
let infoLogsSilenced = false;
function silenceMediapipeInfoLogs(): void {
  if (infoLogsSilenced || typeof console === "undefined") {
    return;
  }
  infoLogsSilenced = true;
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].startsWith("INFO:")) {
      console.info(...args);
      return;
    }
    original(...args);
  };
}

export async function loadVisionTasks(
  wasmBase: string,
  faceModelUrl: string,
  objectModelUrl: string
): Promise<VisionTasks> {
  silenceMediapipeInfoLogs();
  // Dynamic import so a load failure is a catchable, readable error (not an opaque module-eval crash).
  const { FaceLandmarker, FilesetResolver, ObjectDetector } = await import("@mediapipe/tasks-vision");

  // SEPARATE filesets per task: sharing one FilesetResolver (one WASM runtime / GL context) between
  // FaceLandmarker and ObjectDetector makes the object detector silently return zero detections even
  // on a valid frame. Isolating them (costs a second wasm instance) is what makes both work.
  const faceFileset = await FilesetResolver.forVisionTasks(wasmBase);
  const objectFileset = await FilesetResolver.forVisionTasks(wasmBase);

  // BOTH tasks run in IMAGE mode on a per-frame canvas SNAPSHOT (see the hook), never on the shared
  // <video> element directly: two VIDEO-mode tasks calling detectForVideo on one <video> fight over
  // the frame (first consumes it, second gets nothing — which broke BOTH detectors), and IMAGE-mode
  // detect() on a <video> grabs a blank frame. A static canvas hands each detector a real frame.
  const face = await createWithFallback("FaceLandmarker", (delegate) =>
    FaceLandmarker.createFromOptions(faceFileset, {
      baseOptions: { modelAssetPath: faceModelUrl, delegate },
      runningMode: "IMAGE",
      numFaces: 2, // enough to detect a second person; more is wasted work
      outputFacialTransformationMatrixes: true, // for head pose
      outputFaceBlendshapes: false,
    })
  );

  // Force CPU for the object detector. Its GPU delegate can initialize successfully yet return ZERO
  // detections for this EfficientDet model on some GPUs — and createWithFallback only catches a
  // thrown error, not silent-empty, so it would otherwise stay stuck on the broken GPU path. CPU
  // (XNNPACK) is reliable, and at ~1 fps the cost is negligible.
  const object = await ObjectDetector.createFromOptions(objectFileset, {
    baseOptions: { modelAssetPath: objectModelUrl, delegate: "CPU" },
    runningMode: "IMAGE",
    scoreThreshold: OBJECT_SCORE_THRESHOLD,
    maxResults: 5,
  });

  return {
    face,
    object,
    close: () => {
      face.close();
      object.close();
    },
  };
}

/** Extract yaw/pitch (degrees) from a column-major 4x4 facial transformation matrix. */
function eulerFromMatrix(m: number[]): { yaw: number; pitch: number } {
  // element(row i, col j) = m[j*4 + i]. Callers guarantee length >= 11; ?? 0 satisfies strict indexing.
  const r20 = m[2] ?? 0;
  const r21 = m[6] ?? 0;
  const r22 = m[10] ?? 0;
  const toDeg = 180 / Math.PI;
  const pitch = Math.atan2(r21, r22) * toDeg;
  const yaw = Math.atan2(-r20, Math.hypot(r21, r22)) * toDeg;
  return { yaw, pitch };
}

/** A static per-frame snapshot (canvas) — never the shared <video> element (see loadVisionTasks). */
export type FrameSource = HTMLCanvasElement | ImageBitmap;

export function detectFace(face: FaceLandmarker, frame: FrameSource): FaceObservation {
  const result = face.detect(frame);
  const faceCount = result.faceLandmarks?.length ?? 0;

  let yaw: number | null = null;
  let pitch: number | null = null;
  const matrix = result.facialTransformationMatrixes?.[0]?.data;
  if (faceCount > 0 && matrix && matrix.length >= 11) {
    const euler = eulerFromMatrix(Array.from(matrix));
    yaw = euler.yaw;
    pitch = euler.pitch;
  }

  return { faceCount, yaw, pitch };
}

export function detectObjects(object: ObjectDetector, frame: FrameSource): ObjectObservation[] {
  const result = object.detect(frame);
  const raw = result.detections ?? [];
  if (DEBUG_OBJECTS) {
    for (const detection of raw) {
      const c = detection.categories?.[0];
      console.log(`[proctor] object seen: "${c?.categoryName}" score=${(c?.score ?? 0).toFixed(2)}`);
    }
  }

  const detections: ObjectObservation[] = [];
  for (const detection of raw) {
    const category = detection.categories?.[0];
    const label = category?.categoryName ?? "";
    if (label && PROHIBITED.has(label)) {
      detections.push({ label, score: category?.score ?? 0 });
    }
  }
  return detections;
}
