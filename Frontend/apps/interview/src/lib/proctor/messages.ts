// Message contract between the main thread (useProctor) and the MediaPipe inference worker.

export interface ProctorInitMessage {
  type: "init";
  /** Directory of the self-hosted wasm fileset (same-origin, required under COEP). */
  wasmBase: string;
  faceModelUrl: string;
  objectModelUrl: string;
}

export interface ProctorFrameMessage {
  type: "frame";
  bitmap: ImageBitmap;
  timestampMs: number;
}

export interface ProctorCloseMessage {
  type: "close";
}

export type ProctorInbound = ProctorInitMessage | ProctorFrameMessage | ProctorCloseMessage;

export interface ProctorReadyMessage {
  type: "ready";
}

export interface ProctorInitErrorMessage {
  type: "init-error";
  message: string;
}

/** One face-detection observation (from a face frame). */
export interface ProctorFaceMessage {
  type: "face";
  faceCount: number;
  /** Head yaw/pitch in degrees for the primary face, or null when no usable pose. */
  yaw: number | null;
  pitch: number | null;
}

/** Prohibited objects seen in an object-detection frame (already filtered + scored). */
export interface ProctorObjectMessage {
  type: "object";
  detections: { label: string; score: number }[];
}

export type ProctorOutbound =
  | ProctorReadyMessage
  | ProctorInitErrorMessage
  | ProctorFaceMessage
  | ProctorObjectMessage;
