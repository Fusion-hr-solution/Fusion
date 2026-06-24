"use client";

import { useEffect, useRef, useState } from "react";
import Editor, { loader, type BeforeMount, type OnMount } from "@monaco-editor/react";
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
  /** Saved answer for this question (controls the editor's seed value). */
  value: string;
  /** Author-provided starter code, used only when there's no saved answer yet. */
  starterCode?: string;
  onChange: (value: string) => void;
};

export function CodeRunner({
  token,
  questionId,
  language,
  isSql,
  value,
  starterCode,
  onChange,
}: CodeRunnerProps) {
  // Seed from the saved answer, falling back to the starter code. Kept internal so a
  // run sends the editor's current content even before the candidate edits (which is
  // when the parent answer state is still empty). The parent keys this component by
  // questionId, so it re-seeds correctly per question / on resume.
  const [code, setCode] = useState(() => (value && value.length > 0 ? value : starterCode ?? ""));
  const [stdin, setStdin] = useState("");
  const [showStdin, setShowStdin] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CandidateRunResult | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Keep the latest run handler in a ref so the editor's Ctrl/Cmd+Enter command (bound
  // once on mount) always invokes the current closure rather than a stale one.
  const runRef = useRef<() => void>(() => {});
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  // The editor uses a stable height="100%" and the wrapper controls the actual size
  // (fixed vs. flex-1). Force a relayout when toggling fullscreen so Monaco resizes to
  // the new container instead of keeping its previous (taller) dimensions.
  useEffect(() => {
    const frame = requestAnimationFrame(() => editorRef.current?.layout());
    return () => cancelAnimationFrame(frame);
  }, [expanded]);

  // Fullscreen: lock body scroll and let Esc exit.
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

  async function handleRun(): Promise<void> {
    if (running || code.trim().length === 0) {
      return;
    }

    setRunning(true);
    setError(null);
    setResult(null);

    try {
      const res = await runCandidateCode(token, {
        questionId,
        sourceCode: code,
        language,
        stdin: stdin.trim().length > 0 ? stdin : undefined,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed. Please try again.");
    } finally {
      setRunning(false);
    }
  }

  runRef.current = () => void handleRun();

  function handleEditorChange(next: string | undefined): void {
    const text = next ?? "";
    setCode(text);
    onChange(text);
  }

  function handleReset(): void {
    const seed = starterCode ?? "";
    setCode(seed);
    onChange(seed);
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

  const handleBeforeMount: BeforeMount = (monaco) => {
    monaco.editor.defineTheme("interview-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#18181b", // zinc-900, to blend with the panel chrome
        "editorGutter.background": "#18181b",
        "editor.lineHighlightBackground": "#27272a", // zinc-800
        "editorLineNumber.foreground": "#52525b", // zinc-600
        "editorLineNumber.activeForeground": "#a1a1aa", // zinc-400
      },
    });
  };

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
  };

  const canRun = !running && code.trim().length > 0;
  // Only offer Reset when there's actual starter code to return to — otherwise the
  // button would silently wipe the candidate's work to an empty editor.
  const hasStarter = (starterCode ?? "").trim().length > 0;
  const canReset = hasStarter && starterCode !== code;
  const langLabel = isSql ? "SQL" : language?.trim() ? language : "Code";

  return (
    <div
      className={cn(
        "flex flex-col bg-zinc-900 text-zinc-100",
        expanded
          ? "fixed inset-0 z-50"
          : "overflow-hidden rounded-xl border border-zinc-800 shadow-sm"
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
              title="Reset to starter code"
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

      {/* Editor — wrapper controls the height; the editor stays at 100% so toggling
          fullscreen is a clean container resize (no stale Monaco dimensions). */}
      <div className={cn(expanded ? "min-h-0 flex-1" : "h-[360px]")}>
        <Editor
          height="100%"
          theme="interview-dark"
          language={isSql ? "sql" : toMonacoLanguage(language)}
          value={code}
          beforeMount={handleBeforeMount}
          onChange={handleEditorChange}
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
            tabSize: 2,
            automaticLayout: true,
            smoothScrolling: true,
            cursorBlinking: "smooth",
            roundedSelection: true,
            padding: { top: 12, bottom: 12 },
            scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
          }}
        />
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
            {running ? "Running…" : "Run"}
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
