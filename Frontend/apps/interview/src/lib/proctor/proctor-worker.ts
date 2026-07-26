/// <reference lib="webworker" />
//
// MediaPipe inference worker for Layer A proctoring. Runs FaceLandmarker + ObjectDetector on the
// GPU delegate (keeps inference off the CPU that WebContainers is already saturating), alternating
// which model runs per incoming frame to bound GPU load. It posts back raw OBSERVATIONS only —
// the per-signal state machines (debounce, enter/exit) live in the main-thread hook.
//
// No frames or images ever leave this worker: bitmaps are consumed and closed here; only small
// numeric observations are posted to the main thread (which forwards metadata to the server).

import { FaceLandmarker, FilesetResolver, ObjectDetector } from "@mediapipe/tasks-vision";
import type { ProctorInbound, ProctorOutbound } from "./messages";

// COCO labels the ObjectDetector should flag. Kept small + high-signal.
const PROHIBITED = new Set(["cell phone", "book", "laptop"]);
const OBJECT_SCORE_THRESHOLD = 0.4;

let faceLandmarker: FaceLandmarker | null = null;
let objectDetector: ObjectDetector | null = null;
let frameCounter = 0;

const post = (message: ProctorOutbound) => (self as DedicatedWorkerGlobalScope).postMessage(message);

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

async function init(wasmBase: string, faceModelUrl: string, objectModelUrl: string): Promise<void> {
  const fileset = await FilesetResolver.forVisionTasks(wasmBase);

  faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: faceModelUrl, delegate: "GPU" },
    runningMode: "VIDEO",
    numFaces: 2, // enough to detect a second person; more is wasted work
    outputFacialTransformationMatrixes: true, // for head pose
    outputFaceBlendshapes: false,
  });

  objectDetector = await ObjectDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: objectModelUrl, delegate: "GPU" },
    runningMode: "VIDEO",
    scoreThreshold: OBJECT_SCORE_THRESHOLD,
    maxResults: 5,
  });

  post({ type: "ready" });
}

function runFace(bitmap: ImageBitmap, timestampMs: number): void {
  if (!faceLandmarker) {
    return;
  }
  const result = faceLandmarker.detectForVideo(bitmap, timestampMs);
  const faceCount = result.faceLandmarks?.length ?? 0;

  let yaw: number | null = null;
  let pitch: number | null = null;
  const matrix = result.facialTransformationMatrixes?.[0]?.data;
  if (faceCount > 0 && matrix && matrix.length >= 11) {
    const euler = eulerFromMatrix(Array.from(matrix));
    yaw = euler.yaw;
    pitch = euler.pitch;
  }

  post({ type: "face", faceCount, yaw, pitch });
}

function runObject(bitmap: ImageBitmap, timestampMs: number): void {
  if (!objectDetector) {
    return;
  }
  const result = objectDetector.detectForVideo(bitmap, timestampMs);
  const detections: { label: string; score: number }[] = [];
  for (const detection of result.detections ?? []) {
    const category = detection.categories?.[0];
    const label = category?.categoryName ?? "";
    if (label && PROHIBITED.has(label)) {
      detections.push({ label, score: category?.score ?? 0 });
    }
  }
  post({ type: "object", detections });
}

self.onmessage = (event: MessageEvent<ProctorInbound>) => {
  const message = event.data;

  if (message.type === "init") {
    init(message.wasmBase, message.faceModelUrl, message.objectModelUrl).catch((err: unknown) => {
      post({ type: "init-error", message: err instanceof Error ? err.message : "init failed" });
    });
    return;
  }

  if (message.type === "frame") {
    const { bitmap, timestampMs } = message;
    try {
      // Alternate models per frame so each runs at ~half the incoming rate, bounding GPU load.
      if (frameCounter % 2 === 0) {
        runFace(bitmap, timestampMs);
      } else {
        runObject(bitmap, timestampMs);
      }
      frameCounter += 1;
    } finally {
      bitmap.close(); // never retain frame data
    }
    return;
  }

  if (message.type === "close") {
    faceLandmarker?.close();
    objectDetector?.close();
    faceLandmarker = null;
    objectDetector = null;
  }
};
