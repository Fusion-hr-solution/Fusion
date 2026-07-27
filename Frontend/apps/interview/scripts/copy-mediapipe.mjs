// Self-hosts the MediaPipe Tasks-Vision runtime for Layer A proctoring:
//   1. copies the wasm fileset from the @mediapipe/tasks-vision package, and
//   2. downloads the two model files (once, cached) into public/mediapipe/models.
//
// Why self-host: the candidate exam page is cross-origin isolated (COOP + COEP: require-corp for
// WebContainers). Under require-corp the browser BLOCKS cross-origin subresources without CORP
// headers, so loading MediaPipe wasm/models from Google's CDN would fail — they must be same-origin.
// It's also a supply-chain + offline hardening (same rationale as copy-monaco.mjs).
//
// Runs on predev/prebuild. A download failure warns but does not fail the build, so an offline dev
// isn't blocked (Layer A simply degrades until the assets are present).
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);

const destRoot = path.join(process.cwd(), "public", "mediapipe");
const wasmDest = path.join(destRoot, "wasm");
const modelsDest = path.join(destRoot, "models");

// ── 1. wasm fileset (vendored from the installed package) ──
let pkgDir;
try {
  // The package restricts subpath exports, so resolve the entry then walk up to its root.
  const entry = require.resolve("@mediapipe/tasks-vision");
  pkgDir = path.dirname(entry);
} catch {
  console.error("[copy-mediapipe] @mediapipe/tasks-vision is not installed; skipping.");
  process.exit(0);
}

const wasmSrc = path.join(pkgDir, "wasm");
if (!existsSync(wasmSrc)) {
  console.error(`[copy-mediapipe] wasm source not found: ${wasmSrc}`);
  process.exit(1);
}

mkdirSync(wasmDest, { recursive: true });
cpSync(wasmSrc, wasmDest, { recursive: true });
console.log(`[copy-mediapipe] copied wasm ${wasmSrc} -> ${wasmDest}`);

// ── 2. model files (downloaded once, then cached) ──
// Pinned to a specific version path so the model can't silently change under us, and to a known
// SHA-256 so a corrupted or tampered download is rejected rather than served + parsed in the wasm
// worker. Keep in sync with the task options in lib/proctor/proctor-worker.ts.
const MODELS = [
  {
    file: "face_landmarker.task",
    url: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
    sha256: "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff",
  },
  {
    // EfficientDet-Lite2 (int8) — larger/more accurate than Lite0, which wasn't detecting a
    // hand-held phone. Keep the object task's model in sync with lib/proctor/constants.ts.
    file: "efficientdet_lite2.tflite",
    url: "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/int8/1/efficientdet_lite2.tflite",
    sha256: "b3f50554cb0ea559e90328845f7d9ba4d13c8bff372914d24e06bc8bb72fa896",
  },
];

mkdirSync(modelsDest, { recursive: true });

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function ensureModel({ file, url, sha256: expected }) {
  const dest = path.join(modelsDest, file);
  if (existsSync(dest) && sha256(readFileSync(dest)) === expected) {
    console.log(`[copy-mediapipe] model present + verified: ${file}`);
    return;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    const actual = sha256(bytes);
    if (actual !== expected) {
      // Do NOT write a model that fails integrity — it would be served same-origin and parsed by
      // the worker. Remove any stale copy so Layer A degrades instead of loading an unknown model.
      rmSync(dest, { force: true });
      throw new Error(`SHA-256 mismatch (expected ${expected.slice(0, 12)}…, got ${actual.slice(0, 12)}…)`);
    }
    await writeFile(dest, bytes);
    console.log(`[copy-mediapipe] downloaded + verified ${file} (${bytes.length} bytes)`);
  } catch (err) {
    console.warn(
      `[copy-mediapipe] WARN could not obtain a verified ${file}: ${err.message}. ` +
        `Layer A (webcam proctoring) will stay disabled until a valid model is at public/mediapipe/models/${file}.`
    );
  }
}

await Promise.all(MODELS.map(ensureModel));
