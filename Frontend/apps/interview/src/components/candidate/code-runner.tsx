"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Editor, { loader, type OnMount } from "@monaco-editor/react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Cpu,
  Loader2,
  Maximize2,
  Minimize2,
  Play,
  RotateCcw,
  Terminal,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { runCandidateCode, type CandidateRunResult } from "@/services/candidate-access-service";
import { FileExplorer } from "./file-explorer";
import { languageForFile, parseProject, serializeProject } from "@/lib/project";
import { useProjectModel } from "@/lib/use-project-model";
import { defineInterviewDarkTheme } from "@/lib/monaco-theme";

// Self-host the Monaco assets (copied to public/monaco by scripts/copy-monaco.mjs)
// instead of loading from a third-party CDN — supply-chain + CSP + offline safety in
// an exam. basePath is /interview, so public files are served under /interview/...
loader.config({ paths: { vs: "/interview/monaco/vs" } });

function toMonacoLanguage(language?: string): string {
  switch (language?.trim().toLowerCase()) {
    case "javascript":
    case "js":
      return "javascript";
    case "typescript":
    case "ts":
      return "typescript";
    case "python":
      return "python";
    case "java":
      return "java";
    case "csharp":
    case "c#":
      return "csharp";
    case "cpp":
    case "c++":
      return "cpp";
    case "sql":
      return "sql";
    default:
      return "plaintext";
  }
}

type Tone = "success" | "error" | "warning" | "neutral";

function statusTone(status: string): Tone {
  const value = status.toLowerCase();
  if (value.includes("accepted")) return "success";
  if (value.includes("compilation") || value.includes("time limit")) return "warning";
  if (value.includes("error") || value.includes("nzec")) return "error";
  return "neutral";
}

const TONE_STYLES: Record<Tone, { text: string; icon: typeof CheckCircle2 }> = {
  success: { text: "text-emerald-400", icon: CheckCircle2 },
  error: { text: "text-red-400", icon: XCircle },
  warning: { text: "text-amber-400", icon: AlertTriangle },
  neutral: { text: "text-zinc-300", icon: Terminal },
};

type CodeRunnerProps = {
  token: string;
  questionId: string;
  language?: string;
  isSql: boolean;
  /** Saved answer for this question (single-file code, or project JSON for multi-file). */
  value: string;
  /** Author-provided single-file starter, used only when there's no saved answer yet. */
  starterCode?: string;
  /** Author-provided multi-file starter (JSON). Its presence makes the question multi-file. */
  projectFiles?: string;
  /** Browser fingerprint (same one sent on start/submit); forwarded on every run so the
   * server can re-validate the access lock. */
  browserFingerprint?: string;
  onChange: (value: string) => void;
};

/**
 * IMPORTANT: this component seeds its editor state once on mount (see `code`/`seedProject`
 * below). Callers MUST render it with a `key` that is unique per question (e.g.
 * `key={question.id}`) so switching questions remounts it with the new value. Without the
 * key it would keep showing the first question's code.
 */
export function CodeRunner({
  token,
  questionId,
  language,
  isSql,
  value,
  starterCode,
  projectFiles,
  browserFingerprint,
  onChange,
}: CodeRunnerProps) {
  // A question is multi-file when the author provided a project starter.
  const starterProject = useMemo(() => parseProject(projectFiles), [projectFiles]);
  const multiFile = starterProject !== null;

  // ── Single-file state ─────────────────────────────────────────────────────
  const [code, setCode] = useState(() => (value && value.length > 0 ? value : starterCode ?? ""));

  // ── Multi-file state (seed from the saved answer, else the starter project) ─
  const seedProject = useMemo(
    () => parseProject(value) ?? starterProject ?? { entry: "main", files: [{ path: "main", content: "" }] },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const project = useProjectModel(seedProject, onChange);

  // ── Shared state ──────────────────────────────────────────────────────────
  const [stdin, setStdin] = useState("");
  const [showStdin, setShowStdin] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CandidateRunResult | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const runRef = useRef<() => void>(() => {});
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  // Namespace Monaco model URIs per instance — Monaco caches models globally by URI, so two
  // questions that both have a "main.py" would otherwise share (and bleed) the same model.
  const modelNs = useId().replace(/[^a-zA-Z0-9]/g, "");

  // Fullscreen: lock body scroll + Esc to exit.
  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [expanded]);

  // Relayout Monaco when toggling fullscreen so it resizes to the new container.
  useEffect(() => {
    const frame = requestAnimationFrame(() => editorRef.current?.layout());
    return () => cancelAnimationFrame(frame);
  }, [expanded]);

  function onCodeChange(next: string | undefined): void {
    const text = next ?? "";
    setCode(text);
    onChange(text);
  }

  async function handleRun(): Promise<void> {
    if (!canRun) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const stdinValue = stdin.trim().length > 0 ? stdin : undefined;
      const res = await runCandidateCode(
        token,
        multiFile
          ? { questionId, files: project.files, entryPath: project.entryPath, language, stdin: stdinValue, browserFingerprint }
          : { questionId, sourceCode: code, language, stdin: stdinValue, browserFingerprint }
      );
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed. Please try again.");
    } finally {
      setRunning(false);
    }
  }

  runRef.current = () => void handleRun();

  function handleReset(): void {
    if (multiFile && starterProject) {
      project.reset(starterProject);
    } else {
      const seed = starterCode ?? "";
      setCode(seed);
      onChange(seed);
    }
  }

  async function handleCopyOutput(): Promise<void> {
    try {
      await navigator.clipboard.writeText(result?.stdout ?? "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable (permissions/insecure context) — ignore.
    }
  }

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
  };

  const entryFile = project.files.find((f) => f.path === project.entryPath);
  const canRun = !running && (multiFile ? (entryFile?.content.trim().length ?? 0) > 0 : code.trim().length > 0);

  const hasStarter = multiFile ? starterProject !== null : (starterCode ?? "").trim().length > 0;
  const canReset = multiFile
    ? hasStarter && serializeProject({ entry: project.entryPath, files: project.files }) !== serializeProject(starterProject!)
    : (starterCode ?? "") !== code;

  const langLabel = isSql ? "SQL" : language?.trim() ? language : multiFile ? "Project" : "Code";

  return (
    <div
      className={cn(
        "flex flex-col bg-zinc-900 text-zinc-100",
        expanded ? "fixed inset-0 z-50" : "overflow-hidden rounded-xl border border-zinc-800 shadow-sm"
      )}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900 px-3 py-2">
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1.5" aria-hidden>
            <span className="h-3 w-3 rounded-full bg-red-400/90" />
            <span className="h-3 w-3 rounded-full bg-amber-400/90" />
            <span className="h-3 w-3 rounded-full bg-emerald-400/90" />
          </div>
          <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-300">
            {langLabel}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {hasStarter ? (
            <button
              type="button"
              onClick={handleReset}
              disabled={!canReset}
              title={multiFile ? "Reset to starter project" : "Reset to starter code"}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            title={expanded ? "Exit full screen (Esc)" : "Full screen"}
            className="inline-flex items-center rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Editor (+ file explorer when multi-file) */}
      <div className={cn("flex", expanded ? "min-h-0 flex-1" : "h-[360px]")}>
        {multiFile ? (
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
        ) : null}
        <div className="min-w-0 flex-1">
          <Editor
            height="100%"
            theme="interview-dark"
            path={multiFile ? `${modelNs}/${project.activePath}` : undefined}
            language={multiFile ? languageForFile(project.activePath) : isSql ? "sql" : toMonacoLanguage(language)}
            value={multiFile ? project.activeFile?.content ?? "" : code}
            beforeMount={defineInterviewDarkTheme}
            onChange={multiFile ? (v) => project.updateActive(v ?? "") : onCodeChange}
            onMount={handleEditorMount}
            loading={
              <div className="flex h-full min-h-[200px] items-center justify-center text-[13px] text-zinc-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading editor…
              </div>
            }
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              scrollBeyondLastLine: false,
              tabSize: 4,
              automaticLayout: true,
              smoothScrolling: true,
              cursorBlinking: "smooth",
              roundedSelection: true,
              padding: { top: 12, bottom: 12 },
              scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
            }}
          />
        </div>
      </div>

      {/* Custom input (stdin) */}
      <div className="border-t border-zinc-800">
        <button
          type="button"
          onClick={() => setShowStdin((prev) => !prev)}
          className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-[12px] font-medium text-zinc-400 transition-colors hover:text-zinc-200"
        >
          {showStdin ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Custom input (stdin)
        </button>
        {showStdin ? (
          <textarea
            value={stdin}
            onChange={(event) => setStdin(event.target.value)}
            placeholder="Optional input piped to your program's stdin"
            className="min-h-[72px] w-full resize-y border-t border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-[12px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
          />
        ) : null}
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between gap-3 border-t border-zinc-800 bg-zinc-900 px-3 py-2">
        <span className="hidden text-[11px] text-zinc-500 sm:block">
          Runs your code to check it — it does not submit or grade your answer.
        </span>
        <div className="flex items-center gap-2">
          <kbd className="hidden items-center rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 sm:inline-flex">
            ⌘/Ctrl + ↵
          </kbd>
          <button
            type="button"
            onClick={() => void handleRun()}
            disabled={!canRun}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[12px] font-semibold transition-colors",
              canRun
                ? "bg-emerald-500 text-white shadow-sm hover:bg-emerald-400"
                : "cursor-not-allowed bg-zinc-700 text-zinc-400"
            )}
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            <span className="max-w-[160px] truncate">
              {running ? "Running…" : multiFile ? `Run ${project.entryPath}` : "Run"}
            </span>
          </button>
        </div>
      </div>

      {/* Console */}
      <div className={cn("border-t border-zinc-800 bg-zinc-950", expanded && "max-h-[40vh] overflow-auto")}>
        {running ? (
          <div className="flex items-center gap-2 px-3 py-3 text-[12px] text-zinc-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Running your code…
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 px-3 py-3 text-[12px] text-red-300">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        ) : result ? (
          <ResultConsole result={result} copied={copied} onCopy={() => void handleCopyOutput()} />
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] text-zinc-600">
            <Terminal className="h-3.5 w-3.5" /> Output appears here after you run.
          </div>
        )}
      </div>
    </div>
  );
}

function ResultConsole({
  result,
  copied,
  onCopy,
}: {
  result: CandidateRunResult;
  copied: boolean;
  onCopy: () => void;
}) {
  const tone = statusTone(result.executionStatus || result.status);
  const { text: toneText, icon: ToneIcon } = TONE_STYLES[tone];
  const hasStdout = Boolean(result.stdout && result.stdout.length > 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-medium", toneText)}>
          <ToneIcon className="h-4 w-4" />
          {result.executionStatus || result.status}
        </span>
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
          {result.time ? (
            <span className="inline-flex items-center gap-1 rounded bg-zinc-800/80 px-1.5 py-0.5">
              <Clock className="h-3 w-3" /> {result.time}s
            </span>
          ) : null}
          {typeof result.memory === "number" ? (
            <span className="inline-flex items-center gap-1 rounded bg-zinc-800/80 px-1.5 py-0.5">
              <Cpu className="h-3 w-3" /> {(result.memory / 1024).toFixed(1)} MB
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 px-3 pb-3 font-mono text-[12px]">
        {result.compileOutput ? (
          <ConsoleSection label="Compile output" labelClass="text-amber-400" textClass="text-amber-200">
            {result.compileOutput}
          </ConsoleSection>
        ) : null}

        {result.stderr ? (
          <ConsoleSection label="Errors" labelClass="text-red-400" textClass="text-red-300">
            {result.stderr}
          </ConsoleSection>
        ) : null}

        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Output</p>
            {hasStdout ? (
              <button
                type="button"
                onClick={onCopy}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            ) : null}
          </div>
          <pre className="whitespace-pre-wrap break-words text-zinc-100">
            {hasStdout ? result.stdout : <span className="text-zinc-600">(no output)</span>}
          </pre>
        </div>
      </div>
    </div>
  );
}

function ConsoleSection({
  label,
  labelClass,
  textClass,
  children,
}: {
  label: string;
  labelClass: string;
  textClass: string;
  children: string;
}) {
  return (
    <div>
      <p className={cn("mb-1 text-[10px] uppercase tracking-wide", labelClass)}>{label}</p>
      <pre className={cn("whitespace-pre-wrap break-words", textClass)}>{children}</pre>
    </div>
  );
}
