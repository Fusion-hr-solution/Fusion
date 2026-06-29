"use client";

import { useId, useMemo } from "react";
import Editor, { loader } from "@monaco-editor/react";
import { Loader2 } from "lucide-react";
import { FileExplorer } from "../candidate/file-explorer";
import { defineInterviewDarkTheme } from "@/lib/monaco-theme";
import { languageForFile, parseProject, type Project } from "@/lib/project";
import { useProjectModel } from "@/lib/use-project-model";
import { defaultFileName } from "@/lib/project";

// Self-host the Monaco assets (see scripts/copy-monaco.mjs). basePath is /interview.
loader.config({ paths: { vs: "/interview/monaco/vs" } });

type ProjectEditorProps = {
  /** Project JSON ({ entry, files }). The parent seeds a valid project before showing this. */
  value: string;
  language?: string;
  onChange: (json: string) => void;
};

/** Authoring editor for a multi-file starter project: file explorer + Monaco, no run. */
export function ProjectEditor({ value, language, onChange }: ProjectEditorProps) {
  const initial = useMemo<Project>(
    () => parseProject(value) ?? { entry: defaultFileName(language), files: [{ path: defaultFileName(language), content: "" }] },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const project = useProjectModel(initial, onChange);
  // Namespace Monaco model URIs per instance so different questions' files (e.g. two "main.py")
  // never share Monaco's global per-URI model cache.
  const modelNs = useId().replace(/[^a-zA-Z0-9]/g, "");

  return (
    <div className="flex h-[300px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100">
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
      <div className="min-w-0 flex-1">
        <Editor
          height="100%"
          theme="interview-dark"
          path={`${modelNs}/${project.activePath}`}
          language={languageForFile(project.activePath)}
          value={project.activeFile?.content ?? ""}
          beforeMount={defineInterviewDarkTheme}
          onChange={(v) => project.updateActive(v ?? "")}
          loading={
            <div className="flex h-full items-center justify-center text-[13px] text-zinc-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading editor…
            </div>
          }
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            scrollBeyondLastLine: false,
            tabSize: 4,
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
            scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
          }}
        />
      </div>
      <p className="sr-only">The entry file (▶) is the one that runs; others resolve via imports.</p>
    </div>
  );
}
