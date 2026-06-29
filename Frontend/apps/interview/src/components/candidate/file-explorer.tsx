"use client";

import { useState } from "react";
import { FilePlus2, Pencil, Play, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectFile } from "@/lib/project";

type FileExplorerProps = {
  files: ProjectFile[];
  activePath: string;
  entryPath: string;
  onSelect: (path: string) => void;
  onAdd: (name: string) => void;
  onRename: (oldPath: string, newPath: string) => void;
  onDelete: (path: string) => void;
  onSetEntry: (path: string) => void;
};

export function FileExplorer({
  files,
  activePath,
  entryPath,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  onSetEntry,
}: FileExplorerProps) {
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  function commitAdd(): void {
    const name = draft.trim();
    if (name.length > 0) onAdd(name);
    setAdding(false);
    setDraft("");
  }

  function commitRename(oldPath: string): void {
    const name = draft.trim();
    if (name.length > 0 && name !== oldPath) onRename(oldPath, name);
    setRenaming(null);
    setDraft("");
  }

  return (
    <div className="flex w-44 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900/60">
      <div className="flex items-center justify-between px-2.5 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Files</span>
        <button
          type="button"
          onClick={() => {
            setRenaming(null);
            setAdding(true);
            setDraft("");
          }}
          title="New file"
          className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          <FilePlus2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto pb-1">
        {files.map((file) => {
          const isActive = file.path === activePath;
          const isEntry = file.path === entryPath;
          return (
            <div
              key={file.path}
              className={cn(
                "group flex items-center gap-1 px-2 py-1 text-[12px]",
                isActive ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800/50"
              )}
            >
              {renaming === file.path ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commitRename(file.path)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(file.path);
                    if (e.key === "Escape") {
                      setRenaming(null);
                      setDraft("");
                    }
                  }}
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-1 py-0.5 font-mono text-[11px] text-zinc-100 focus:outline-none"
                />
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onSelect(file.path)}
                    onDoubleClick={() => {
                      setAdding(false);
                      setRenaming(file.path);
                      setDraft(file.path);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-1 truncate text-left font-mono"
                    title={file.path}
                  >
                    {isEntry ? <Play className="h-3 w-3 shrink-0 text-emerald-400" /> : <span className="w-3 shrink-0" />}
                    <span className="truncate">{file.path}</span>
                  </button>
                  <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    {!isEntry ? (
                      <button
                        type="button"
                        onClick={() => onSetEntry(file.path)}
                        title="Set as entry"
                        className="rounded p-0.5 text-zinc-500 hover:text-emerald-400"
                      >
                        <Play className="h-3 w-3" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setAdding(false);
                        setRenaming(file.path);
                        setDraft(file.path);
                      }}
                      title="Rename"
                      className="rounded p-0.5 text-zinc-500 hover:text-zinc-200"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(file.path)}
                      disabled={files.length <= 1}
                      title={files.length <= 1 ? "Keep at least one file" : "Delete file"}
                      className="rounded p-0.5 text-zinc-500 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                </>
              )}
            </div>
          );
        })}

        {adding ? (
          <div className="px-2 py-1">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitAdd}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitAdd();
                if (e.key === "Escape") {
                  setAdding(false);
                  setDraft("");
                }
              }}
              placeholder="filename.py"
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-1 py-0.5 font-mono text-[11px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
