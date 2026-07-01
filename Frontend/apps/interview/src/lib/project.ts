// Shared types + (de)serialization for multi-file coding answers. A multi-file question's
// starter (question.projectFiles) and the candidate's saved answer (answerText) both use this
// JSON shape: { entry, files: [{ path, content }] }.

export interface ProjectFile {
  path: string;
  content: string;
}

export interface Project {
  entry: string;
  files: ProjectFile[];
}

/** Tolerant parse — returns null when the JSON isn't a non-empty project. */
export function parseProject(json?: string | null): Project | null {
  if (!json || json.trim().length === 0) {
    return null;
  }
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const obj = parsed as { entry?: unknown; files?: unknown };
    if (!Array.isArray(obj.files)) {
      return null;
    }
    const files: ProjectFile[] = [];
    for (const item of obj.files) {
      if (!item || typeof item !== "object") continue;
      const file = item as { path?: unknown; content?: unknown };
      if (typeof file.path !== "string" || file.path.trim().length === 0) continue;
      files.push({ path: file.path, content: typeof file.content === "string" ? file.content : "" });
    }
    if (files.length === 0) {
      return null;
    }
    const entry =
      typeof obj.entry === "string" && files.some((f) => f.path === obj.entry) ? obj.entry : files[0]!.path;
    return { entry, files };
  } catch {
    return null;
  }
}

export function serializeProject(project: Project): string {
  return JSON.stringify({ entry: project.entry, files: project.files });
}

/** Monaco language id from a file extension (for per-file syntax highlighting). */
export function languageForFile(path: string): string {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  switch (ext) {
    case "py":
      return "python";
    case "js":
    case "mjs":
    case "cjs":
      return "javascript";
    case "ts":
      return "typescript";
    case "java":
      return "java";
    case "cpp":
    case "cc":
    case "cxx":
    case "h":
    case "hpp":
      return "cpp";
    case "cs":
      return "csharp";
    case "sql":
      return "sql";
    case "json":
      return "json";
    default:
      return "plaintext";
  }
}

/** A sensible default filename for a new file, given the project language. */
export function defaultFileName(language?: string): string {
  switch (language?.trim().toLowerCase()) {
    case "javascript":
    case "js":
      return "module.js";
    case "typescript":
    case "ts":
      return "module.ts";
    case "java":
      return "Helper.java";
    case "cpp":
    case "c++":
      return "helper.cpp";
    case "csharp":
    case "c#":
      return "Helper.cs";
    default:
      return "module.py";
  }
}
