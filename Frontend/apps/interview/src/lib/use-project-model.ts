import { useState } from "react";
import { serializeProject, type Project, type ProjectFile } from "./project";

export interface ProjectModel {
  files: ProjectFile[];
  entryPath: string;
  activePath: string;
  activeFile: ProjectFile | undefined;
  setActivePath: (path: string) => void;
  addFile: (name: string) => void;
  renameFile: (oldPath: string, newName: string) => void;
  deleteFile: (path: string) => void;
  setEntry: (path: string) => void;
  updateActive: (content: string) => void;
  reset: (project: Project) => void;
}

/**
 * Manages a multi-file project (files + entry + active selection) and serializes every
 * mutation back through `onChange` as project JSON. Shared by the candidate runner and the
 * authoring editor so the file operations live in one place.
 */
export function useProjectModel(initial: Project, onChange: (json: string) => void): ProjectModel {
  const [files, setFiles] = useState<ProjectFile[]>(initial.files);
  const [entryPath, setEntryPath] = useState(initial.entry);
  const [activePath, setActivePath] = useState(initial.entry);

  const propagate = (nextFiles: ProjectFile[], nextEntry: string) =>
    onChange(serializeProject({ entry: nextEntry, files: nextFiles }));

  const addFile = (name: string): void => {
    const path = name.trim();
    if (path.length === 0 || files.some((f) => f.path === path)) return;
    const next = [...files, { path, content: "" }];
    setFiles(next);
    setActivePath(path);
    propagate(next, entryPath);
  };

  const renameFile = (oldPath: string, newName: string): void => {
    const path = newName.trim();
    if (path.length === 0 || files.some((f) => f.path === path)) return;
    const next = files.map((f) => (f.path === oldPath ? { ...f, path } : f));
    const nextEntry = entryPath === oldPath ? path : entryPath;
    setFiles(next);
    setEntryPath(nextEntry);
    if (activePath === oldPath) setActivePath(path);
    propagate(next, nextEntry);
  };

  const deleteFile = (path: string): void => {
    if (files.length <= 1) return;
    const next = files.filter((f) => f.path !== path);
    const nextEntry = entryPath === path ? next[0]!.path : entryPath;
    setFiles(next);
    setEntryPath(nextEntry);
    if (activePath === path) setActivePath(nextEntry);
    propagate(next, nextEntry);
  };

  const setEntry = (path: string): void => {
    setEntryPath(path);
    propagate(files, path);
  };

  const updateActive = (content: string): void => {
    const next = files.map((f) => (f.path === activePath ? { ...f, content } : f));
    setFiles(next);
    propagate(next, entryPath);
  };

  const reset = (project: Project): void => {
    setFiles(project.files);
    setEntryPath(project.entry);
    setActivePath(project.entry);
    propagate(project.files, project.entry);
  };

  return {
    files,
    entryPath,
    activePath,
    activeFile: files.find((f) => f.path === activePath) ?? files[0],
    setActivePath,
    addFile,
    renameFile,
    deleteFile,
    setEntry,
    updateActive,
    reset,
  };
}
