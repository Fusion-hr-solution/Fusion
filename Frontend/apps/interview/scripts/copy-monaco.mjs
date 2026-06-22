// Copies the Monaco editor AMD assets into public/monaco so the editor loads from
// our own origin instead of a third-party CDN. In an exam context a CDN is a
// supply-chain risk and a CSP/offline failure point. Runs on predev/prebuild.
import { createRequire } from "node:module";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);

let monacoDir;
try {
  monacoDir = path.dirname(require.resolve("monaco-editor/package.json"));
} catch {
  console.error("[copy-monaco] monaco-editor is not installed; skipping.");
  process.exit(0);
}

const src = path.join(monacoDir, "min", "vs");
if (!existsSync(src)) {
  console.error(`[copy-monaco] source not found: ${src}`);
  process.exit(1);
}

const destRoot = path.join(process.cwd(), "public", "monaco");
const dest = path.join(destRoot, "vs");

rmSync(dest, { recursive: true, force: true });
mkdirSync(destRoot, { recursive: true });
cpSync(src, dest, { recursive: true });

console.log(`[copy-monaco] copied ${src} -> ${dest}`);
