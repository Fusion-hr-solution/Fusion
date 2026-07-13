"use client";

// Cross-origin-ISOLATED host for a "Frontend Project" question. This route is served with
// COOP/COEP headers (see next.config.ts) so `SharedArrayBuffer` — and therefore WebContainers —
// is available. It is embedded as a same-origin <iframe> by <FrontendSessionSandbox>.
//
// Protocol with the parent window (all messages same-origin-checked):
//   iframe → parent : { type: "sandbox-ready" }              mounted, asks to be seeded
//   parent → iframe : { type: "prewarm", framework }         boot the framework's default template
//                                                            (install deps + dev server) — timer-free
//   parent → iframe : { type: "init", framework, project }   boot directly with these files
//   parent → iframe : { type: "init-files", project }        swap real files into the WARM container
//   iframe → parent : { type: "status", phase }              booting|installing|starting|ready|error
//   iframe → parent : { type: "change", project }            serialized files, to persist

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor, { loader } from "@monaco-editor/react";
import type { WebContainer, WebContainerProcess } from "@webcontainer/api";
import { Loader2, Maximize2, Minimize2, RefreshCw } from "lucide-react";
import { FileExplorer } from "@/components/candidate/file-explorer";
import { useProjectModel } from "@/lib/use-project-model";
import { languageForFile, parseProject, type Project } from "@/lib/project";
import { defineInterviewDarkTheme } from "@/lib/monaco-theme";
import {
  frameworkDevCommand,
  frameworkStarterProject,
  normalizeFramework,
  toFileSystemTree,
  type FrontendFramework,
} from "@/lib/frontend-templates";

loader.config({ paths: { vs: "/interview/monaco/vs" } });

type Phase = "idle" | "booting" | "installing" | "starting" | "ready" | "error";

export default function FrontendSandboxPage() {
  const [seed, setSeed] = useState<{ framework: FrontendFramework; project: Project } | null>(null);

  // Seed on the first `prewarm` (default template) or `init` (explicit files); later `init-files`
  // messages are handled inside <Sandbox> to swap files into the already-booted container.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; framework?: string; project?: string };

      if (data?.type === "prewarm") {
        const framework = normalizeFramework(data.framework);
        setSeed((prev) => prev ?? { framework, project: frameworkStarterProject(framework) });
      } else if (data?.type === "init") {
        const framework = normalizeFramework(data.framework);
        setSeed((prev) => prev ?? { framework, project: parseProject(data.project) ?? frameworkStarterProject(framework) });
      }
    }
    window.addEventListener("message", onMessage);
    window.parent?.postMessage({ type: "sandbox-ready" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!seed) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-[13px] text-zinc-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing…
      </div>
    );
  }

  return <Sandbox framework={seed.framework} initial={seed.project} />;
}

function Sandbox({ framework, initial }: { framework: FrontendFramework; initial: Project }) {
  const emitChange = useCallback((json: string) => {
    window.parent?.postMessage({ type: "change", project: json }, window.location.origin);
  }, []);

  const project = useProjectModel(initial, emitChange);
  const modelNs = useMemo(() => Math.random().toString(36).slice(2), []);

  const containerRef = useRef<WebContainer | null>(null);
  const devProcRef = useRef<WebContainerProcess | null>(null);
  const bootStartedRef = useRef(false);
  const prevPathsRef = useRef<string[]>(initial.files.map((f) => f.path));

  const [phase, setPhase] = useState<Phase>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [log, setLog] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const appendLog = useCallback((chunk: string) => {
    setLog((prev) => (prev + chunk).slice(-8000));
  }, []);

  // Fullscreen is owned by the parent overlay (it controls geometry); we just request a toggle and
  // reflect the state it echoes back so the button icon matches.
  const toggleFullscreen = useCallback(
    () => window.parent?.postMessage({ type: "toggle-fullscreen" }, window.location.origin),
    [],
  );
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; value?: boolean };
      if (data?.type === "fullscreen") setIsFullscreen(Boolean(data.value));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Report every phase change to the parent so it can drive the pre-warm progress bar.
  useEffect(() => {
    window.parent?.postMessage({ type: "status", phase }, window.location.origin);
  }, [phase]);

  const boot = useCallback(async () => {
    if (bootStartedRef.current) return;
    bootStartedRef.current = true;

    if (!globalThis.crossOriginIsolated) {
      setPhase("error");
      setError("This page is not cross-origin isolated, so the runtime can't start. Check the COOP/COEP headers.");
      return;
    }

    try {
      setPhase("booting");
      const { WebContainer } = await import("@webcontainer/api");
      const instance = await WebContainer.boot();
      containerRef.current = instance;

      await instance.mount(toFileSystemTree(project.files));

      instance.on("server-ready", (_port, url) => {
        setPreviewUrl(url);
        setPhase("ready");
      });

      setPhase("installing");
      const install = await instance.spawn("npm", ["install"]);
      install.output.pipeTo(new WritableStream({ write: (data) => appendLog(data) }));
      const installExit = await install.exit;
      if (installExit !== 0) {
        setPhase("error");
        setError(`Dependency install failed (exit ${installExit}). See the log below.`);
        return;
      }

      setPhase("starting");
      const [cmd, args] = frameworkDevCommand(framework);
      const dev = await instance.spawn(cmd, args);
      devProcRef.current = dev;
      dev.output.pipeTo(new WritableStream({ write: (data) => appendLog(data) }));
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Failed to start the runtime.");
    }
  }, [appendLog, framework, project.files]);

  // Boot once, on mount.
  useEffect(() => {
    void boot();
    return () => {
      devProcRef.current?.kill();
      containerRef.current?.teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap the real starter/saved files into the ALREADY-WARM container (node_modules untouched, so
  // the dev server just hot-reloads). Held in a ref so the listener stays subscribed once.
  const applyFilesRef = useRef<(p: Project) => void>(() => {});
  applyFilesRef.current = (parsed: Project) => {
    project.reset(parsed);
    const instance = containerRef.current;
    if (instance) {
      prevPathsRef.current = parsed.files.map((f) => f.path);
      void instance.mount(toFileSystemTree(parsed.files)).catch(() => {});
    }
  };
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; project?: string };
      if (data?.type !== "init-files" || typeof data.project !== "string") return;
      const parsed = parseProject(data.project);
      if (parsed) applyFilesRef.current(parsed);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Write the active file through to the running container on every keystroke (dev-server HMR).
  const onEditorChange = useCallback(
    (value: string | undefined) => {
      const next = value ?? "";
      project.updateActive(next);
      const instance = containerRef.current;
      if (instance) void instance.fs.writeFile(project.activePath, next).catch(() => {});
    },
    [project],
  );

  // Sync structural changes (add / delete / rename) to the container filesystem.
  const pathKey = project.files.map((f) => f.path).join("|");
  useEffect(() => {
    const instance = containerRef.current;
    if (!instance || phase === "idle" || phase === "booting") return;
    const current = project.files.map((f) => f.path);
    const removed = prevPathsRef.current.filter((p) => !current.includes(p));
    prevPathsRef.current = current;
    void (async () => {
      for (const p of removed) {
        try {
          await instance.fs.rm(p);
        } catch {
          /* already gone */
        }
      }
      await instance.mount(toFileSystemTree(project.files)).catch(() => {});
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathKey]);

  const statusLabel: Record<Phase, string> = {
    idle: "Idle",
    booting: "Starting runtime…",
    installing: "Installing dependencies…",
    starting: "Starting dev server…",
    ready: "Running",
    error: "Error",
  };

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-[11px] font-medium capitalize text-zinc-300">
          {framework}
        </span>
        <div className="flex items-center gap-2 text-[11px] text-zinc-400">
          {phase !== "ready" && phase !== "error" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          <span>{statusLabel[phase]}</span>
          {previewUrl ? (
            <button
              type="button"
              onClick={() => setPreviewUrl((u) => (u ? `${u.split("#")[0]}#${Date.now()}` : u))}
              title="Reload preview"
              className="inline-flex items-center rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit full screen (Esc)" : "Full screen"}
            className="inline-flex items-center rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <FileExplorer
          files={project.files}
          activePath={project.activePath}
          entryPath={project.entryPath}
          onSelect={project.setActivePath}
          onAdd={project.addFile}
          onRename={project.renameFile}
          onDelete={project.deleteFile}
          onSetEntry={project.setEntry}
        />

        <div className="min-w-0 flex-1 border-r border-zinc-800">
          <Editor
            height="100%"
            theme="interview-dark"
            path={`${modelNs}/${project.activePath}`}
            language={languageForFile(project.activePath)}
            value={project.activeFile?.content ?? ""}
            beforeMount={defineInterviewDarkTheme}
            onChange={onEditorChange}
            loading={
              <div className="flex h-full items-center justify-center text-[13px] text-zinc-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading editor…
              </div>
            }
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              scrollBeyondLastLine: false,
              tabSize: 2,
              automaticLayout: true,
              padding: { top: 12, bottom: 12 },
            }}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col bg-white">
          {phase === "error" ? (
            <div className="flex h-full flex-col gap-2 overflow-auto bg-zinc-950 p-3 text-[12px] text-red-300">
              <p className="font-semibold text-red-400">{error ?? "Something went wrong."}</p>
              <pre className="whitespace-pre-wrap break-words text-zinc-400">{log}</pre>
            </div>
          ) : previewUrl ? (
            <iframe title="Live preview" src={previewUrl} className="h-full w-full border-0 bg-white" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-zinc-900 text-[13px] text-zinc-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{statusLabel[phase]}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
